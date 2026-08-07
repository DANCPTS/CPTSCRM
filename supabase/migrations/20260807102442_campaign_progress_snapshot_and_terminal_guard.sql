/*
# Authoritative campaign progress snapshot + terminal-sent guard (corrected v2)

Same intent as the prior application; only difference is dropping the existing
get_campaign_progress function first because its return column set changed.
See prior migration comment for the full explanation. NON-DESTRUCTIVE: adds a
read function and a protective BEFORE UPDATE trigger only; no recipient status
is reset and the active worker is not interrupted.

1. get_campaign_progress(uuid) - single authoritative snapshot from
   campaign_recipients; "sent" derived from the monotonic `sent` boolean.
2. trg_protect_terminal_sent - blocks reverting an accepted send back to a
   sendable/failed/excluded state while allowing forward provider states.
*/

-- 1. Terminal-sent guard -------------------------------------------------------
CREATE OR REPLACE FUNCTION protect_terminal_sent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.sent = true THEN
    NEW.sent := true;
    NEW.sent_at := COALESCE(OLD.sent_at, NEW.sent_at);
    IF NEW.delivery_status IN ('pending', 'processing', 'retry_wait', 'failed', 'skipped', 'suppressed', 'skipped_unsubscribed') THEN
      NEW.delivery_status := OLD.delivery_status;
    END IF;
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
DROP FUNCTION IF EXISTS get_campaign_progress(uuid);

CREATE FUNCTION get_campaign_progress(p_campaign_id uuid)
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
  delivered bigint,
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
      count(*) FILTER (WHERE cr.sent = true) AS c_sent,
      count(*) FILTER (WHERE cr.sent = true AND cr.delivery_status = 'delivered') AS c_delivered,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'pending') AS c_pending,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'processing') AS c_processing,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'retry_wait') AS c_retrying,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'failed' AND (cr.last_error_code IS NULL OR cr.last_error_code <> 'invalid_email')) AS c_failed,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'failed' AND cr.last_error_code = 'invalid_email') AS c_invalid,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status = 'skipped') AS c_skipped,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status IN ('suppressed', 'skipped_unsubscribed')) AS c_suppressed,
      count(*) FILTER (WHERE cr.sent = false AND cr.delivery_status NOT IN ('pending','processing','retry_wait','failed','skipped','suppressed','skipped_unsubscribed')) AS c_other_unsent,
      count(*) FILTER (WHERE cr.opened_at IS NOT NULL) AS c_opened,
      count(*) FILTER (WHERE cr.clicked_at IS NOT NULL) AS c_clicked,
      count(*) FILTER (WHERE cr.replied_at IS NOT NULL) AS c_replied,
      count(*) FILTER (WHERE cr.unsubscribed_at IS NOT NULL) AS c_unsubscribed,
      count(*) FILTER (WHERE cr.bounce_type = 'hard') AS c_bounced_hard,
      count(*) FILTER (WHERE cr.bounce_type = 'soft') AS c_bounced_soft,
      count(*) FILTER (WHERE cr.spam_reported_at IS NOT NULL) AS c_spam
    FROM campaign_recipients cr
    WHERE cr.campaign_id = p_campaign_id
  )
  SELECT
    c.c_total,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_pending END,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_processing END,
    CASE WHEN v_job_status = 'cancelled' THEN 0 ELSE c.c_retrying END,
    c.c_sent,
    c.c_failed,
    c.c_invalid,
    c.c_skipped + c.c_other_unsent,
    c.c_suppressed,
    CASE WHEN v_job_status = 'cancelled' THEN (c.c_pending + c.c_processing + c.c_retrying) ELSE 0 END,
    c.c_delivered,
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
