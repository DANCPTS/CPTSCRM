/*
# Authoritative campaign progress snapshot + terminal-sent guard

Fixes inconsistent campaign progress counters (the background-job panel and the
Campaign Report showed different sent totals, and the sent count could briefly
decrease). Introduces ONE authoritative progress query derived directly from the
recipient delivery-status records, plus a database guard that makes the `sent`
status truly terminal. This is a non-destructive change: no recipient status is
reset, no data removed, and the active worker is not interrupted.

1. New function `get_campaign_progress(p_campaign_id uuid)`
   - Returns a single consistent snapshot of a campaign, computed live from
     `campaign_recipients` (grouped by delivery_status) joined with the job's
     heartbeat/throttle state from `campaign_send_jobs`.
   - Columns: total, pending, processing, retrying, sent, failed, invalid,
     skipped, suppressed, cancelled, opened, clicked, replied, unsubscribed,
     bounced_hard, bounced_soft, spam, job_status, throttled, last_activity_at,
     snapshot_at, and a monotonically increasing `version` (microsecond epoch).
   - The status buckets always partition the whole audience so counts reconcile
     with the total. When the job is cancelled, the still-sendable recipients
     (pending/processing/retrying) are reported under `cancelled` instead.
   - Both UI sections read this one result, so they can never disagree.

2. New trigger `trg_protect_terminal_sent` on `campaign_recipients`
   - BEFORE UPDATE guard: once a recipient's `delivery_status` is `sent`, no
     process (worker, retry handler, webhook, lease recovery) can move it back to
     a sendable/failed state. The guard forces `delivery_status` to stay `sent`
     and `sent` to stay true, while still allowing provider event fields
     (opened, clicked, bounced, complaint, unsubscribed, message id) to update.
   - This makes the cumulative sent count monotonic at the database level.

3. Security
   - `get_campaign_progress` is SECURITY DEFINER with a locked search_path and is
     granted to anon + authenticated (read-only aggregate, no sensitive data).

4. Important notes
   1. NON-DESTRUCTIVE / NON-INTERRUPTING: adds a read function and a protective
      trigger only. Existing statuses, message IDs, opens, clicks, replies and
      unsubscribe records are untouched, and the running worker keeps sending.
   2. The guard only ever PREVENTS a regression away from `sent`; the normal
      pending -> processing -> sent path is unaffected.
*/

-- 1. Terminal-sent guard -------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_terminal_sent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Once accepted/sent, the send status is terminal. Provider events may still
  -- update engagement/delivery fields, but must not revert the send status.
  IF OLD.delivery_status = 'sent' THEN
    NEW.delivery_status := 'sent';
    NEW.sent := true;
    NEW.sent_at := COALESCE(NEW.sent_at, OLD.sent_at);
    NEW.attempts := GREATEST(COALESCE(NEW.attempts, 0), COALESCE(OLD.attempts, 0));
    NEW.lease_expires_at := NULL;
    NEW.next_attempt_at := NULL;
    NEW.resend_message_id := COALESCE(NEW.resend_message_id, OLD.resend_message_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_terminal_sent ON campaign_recipients;
CREATE TRIGGER trg_protect_terminal_sent
  BEFORE UPDATE ON campaign_recipients
  FOR EACH ROW
  EXECUTE FUNCTION protect_terminal_sent();

-- 2. Authoritative progress snapshot ------------------------------------------
CREATE OR REPLACE FUNCTION get_campaign_progress(p_campaign_id uuid)
RETURNS TABLE (
  total bigint,
  pending bigint,
  processing bigint,
  retrying bigint,
  sent bigint,
  failed bigint,
  invalid bigint,
  skipped bigint,
  suppressed bigint,
  cancelled bigint,
  opened bigint,
  clicked bigint,
  replied bigint,
  unsubscribed bigint,
  bounced_hard bigint,
  bounced_soft bigint,
  spam bigint,
  job_status text,
  throttled boolean,
  last_activity_at timestamptz,
  snapshot_at timestamptz,
  version bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_status text;
  v_throttled boolean;
  v_last_activity timestamptz;
BEGIN
  SELECT j.status, j.throttled, j.last_heartbeat_at
  INTO v_job_status, v_throttled, v_last_activity
  FROM campaign_send_jobs j
  WHERE j.campaign_id = p_campaign_id;

  RETURN QUERY
  WITH c AS (
    SELECT
      count(*) AS c_total,
      count(*) FILTER (WHERE delivery_status = 'pending') AS c_pending,
      count(*) FILTER (WHERE delivery_status = 'processing') AS c_processing,
      count(*) FILTER (WHERE delivery_status = 'retry_wait') AS c_retrying,
      count(*) FILTER (WHERE delivery_status = 'sent') AS c_sent,
      count(*) FILTER (WHERE delivery_status = 'failed' AND (last_error_code IS NULL OR last_error_code <> 'invalid_email')) AS c_failed,
      count(*) FILTER (WHERE delivery_status = 'failed' AND last_error_code = 'invalid_email') AS c_invalid,
      count(*) FILTER (WHERE delivery_status = 'skipped') AS c_skipped,
      count(*) FILTER (WHERE delivery_status IN ('suppressed', 'skipped_unsubscribed')) AS c_suppressed,
      count(*) FILTER (WHERE opened_at IS NOT NULL) AS c_opened,
      count(*) FILTER (WHERE clicked_at IS NOT NULL) AS c_clicked,
      count(*) FILTER (WHERE replied_at IS NOT NULL) AS c_replied,
      count(*) FILTER (WHERE unsubscribed_at IS NOT NULL) AS c_unsubscribed,
      count(*) FILTER (WHERE bounce_type = 'hard') AS c_bounced_hard,
      count(*) FILTER (WHERE bounce_type = 'soft') AS c_bounced_soft,
      count(*) FILTER (WHERE spam_reported_at IS NOT NULL) AS c_spam
    FROM campaign_recipients
    WHERE campaign_id = p_campaign_id
  )
  SELECT
    c.c_total,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_pending END,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_processing END,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_retrying END,
    c.c_sent,
    c.c_failed,
    c.c_invalid,
    c.c_skipped,
    c.c_suppressed,
    CASE WHEN v_job_status = 'cancelled' THEN (c.c_pending + c.c_processing + c.c_retrying) ELSE 0 END,
    c.c_opened,
    c.c_clicked,
    c.c_replied,
    c.c_unsubscribed,
    c.c_bounced_hard,
    c.c_bounced_soft,
    c.c_spam,
    v_job_status,
    COALESCE(v_throttled, false),
    v_last_activity,
    clock_timestamp(),
    (extract(epoch FROM clock_timestamp()) * 1000000)::bigint
  FROM c;
END;
$$;

GRANT EXECUTE ON FUNCTION get_campaign_progress(uuid) TO anon, authenticated;
