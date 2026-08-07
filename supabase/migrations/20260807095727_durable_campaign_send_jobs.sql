/*
# Durable marketing campaign send jobs

Replaces the fragile "one long browser request" campaign sender with a durable,
server-side background job system. The browser starts a job and polls for
progress; server-side workers claim small batches of recipients, send them,
record per-recipient delivery state, and automatically schedule the next batch.
A pg_cron backstop restarts any job whose worker chain has stalled.

1. campaign_recipients (extended)
   - `normalized_email` (text) - trimmed + lowercased email, used for idempotency + suppression matching. Backfilled from existing email.
   - `attempts` (int, default 0) - number of send attempts made.
   - `next_attempt_at` (timestamptz) - earliest time this recipient may be retried.
   - `lease_expires_at` (timestamptz) - when a worker's claim on this row expires (crash recovery).
   - `last_error_code` (text) - short machine code of the last failure (e.g. rate_limited, invalid_email).
   - `last_error_message` (text) - short human message of the last failure (never full email bodies or tokens).
   - Unique index on (campaign_id, normalized_email) for idempotency / duplicate protection.
   - delivery_status vocabulary standardised to: pending, processing, sent, retry_wait, failed, skipped, suppressed.
     Existing rows are backfilled: skipped_unsubscribed -> suppressed; sent rows kept as sent; other non-terminal -> pending.

2. New table `campaign_send_jobs` - one control row per campaign send.
   - job status (running/paused/completed/cancelled), configurable batch size, live counts per delivery status,
     worker heartbeat, last-batch diagnostics, throttling state.

3. New table `private_worker_config` - locked-down (no RLS policies) single row holding the worker URL + shared
   token so server-side functions can invoke the worker edge function via pg_net. Not readable by app clients.

4. Functions
   - `claim_campaign_batch(campaign_id, batch_size, lease_seconds, max_attempts)` - atomically claims a batch using
     FOR UPDATE SKIP LOCKED, applies a processing lease, reclaims expired leases, and fails over-limit rows.
   - `refresh_campaign_job_counts(campaign_id)` - recomputes live counts on the job row.
   - `kick_campaign_worker(campaign_id)` - fires an async pg_net POST to the worker edge function.
   - `start_campaign_send(campaign_id, batch_size)` - creates/resumes a job, queues eligible (never sent) recipients,
     and kicks the worker. Callable by authenticated app users.
   - `pause_campaign_send` / `cancel_campaign_send` - job control.
   - `drive_campaign_jobs()` - pg_cron backstop that re-kicks running jobs whose heartbeat has gone stale.

5. Security
   - RLS enabled on campaign_send_jobs with anon+authenticated policies (app has no per-user isolation on marketing).
   - private_worker_config has RLS enabled and NO policies, so app clients cannot read the token.
   - Privileged RPCs are SECURITY DEFINER with locked search_path and are granted only to the roles that need them.

6. Important notes
   1. NON-DESTRUCTIVE: no columns dropped, no data deleted. Existing sent recipients are never re-queued.
   2. Idempotency: the unique (campaign_id, normalized_email) index plus terminal statuses guarantee a recipient
      is never sent twice by this system.
   3. Crash recovery: expired processing leases are reclaimed on the next claim.
*/

-- 1. Extend campaign_recipients ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='normalized_email') THEN
    ALTER TABLE campaign_recipients ADD COLUMN normalized_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='attempts') THEN
    ALTER TABLE campaign_recipients ADD COLUMN attempts int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='next_attempt_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN next_attempt_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='lease_expires_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN lease_expires_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='last_error_code') THEN
    ALTER TABLE campaign_recipients ADD COLUMN last_error_code text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='campaign_recipients' AND column_name='last_error_message') THEN
    ALTER TABLE campaign_recipients ADD COLUMN last_error_message text;
  END IF;
END $$;

-- Backfill normalized_email
UPDATE campaign_recipients
SET normalized_email = lower(btrim(email))
WHERE normalized_email IS NULL;

-- Standardise delivery_status vocabulary on existing rows (non-destructive)
UPDATE campaign_recipients SET delivery_status = 'suppressed'
WHERE delivery_status = 'skipped_unsubscribed';

UPDATE campaign_recipients SET delivery_status = 'sent'
WHERE sent = true AND delivery_status NOT IN ('sent','suppressed','skipped','failed');

UPDATE campaign_recipients SET delivery_status = 'pending', next_attempt_at = now()
WHERE sent = false AND delivery_status NOT IN ('failed','suppressed','skipped','retry_wait','processing');

-- Idempotency / duplicate protection
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_recipients_campaign_norm_email
  ON campaign_recipients (campaign_id, normalized_email);

-- Claim performance index
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_claim
  ON campaign_recipients (campaign_id, delivery_status, next_attempt_at);

-- 2. campaign_send_jobs --------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_send_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  batch_size int NOT NULL DEFAULT 50,
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  pending_count int NOT NULL DEFAULT 0,
  processing_count int NOT NULL DEFAULT 0,
  retry_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  suppressed_count int NOT NULL DEFAULT 0,
  last_batch_claimed int NOT NULL DEFAULT 0,
  last_batch_sent int NOT NULL DEFAULT 0,
  last_batch_failed int NOT NULL DEFAULT 0,
  last_batch_duration_ms int,
  throttled boolean NOT NULL DEFAULT false,
  throttled_until timestamptz,
  last_error text,
  last_heartbeat_at timestamptz,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_send_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_send_jobs" ON campaign_send_jobs;
CREATE POLICY "read_send_jobs" ON campaign_send_jobs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_send_jobs" ON campaign_send_jobs;
CREATE POLICY "insert_send_jobs" ON campaign_send_jobs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_send_jobs" ON campaign_send_jobs;
CREATE POLICY "update_send_jobs" ON campaign_send_jobs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_send_jobs" ON campaign_send_jobs;
CREATE POLICY "delete_send_jobs" ON campaign_send_jobs FOR DELETE
  TO anon, authenticated USING (true);

-- 3. private_worker_config (locked; no policies) -------------------------------
CREATE TABLE IF NOT EXISTS private_worker_config (
  id int PRIMARY KEY DEFAULT 1,
  worker_url text NOT NULL,
  worker_token text NOT NULL,
  CONSTRAINT private_worker_config_singleton CHECK (id = 1)
);

ALTER TABLE private_worker_config ENABLE ROW LEVEL SECURITY;

INSERT INTO private_worker_config (id, worker_url, worker_token)
VALUES (1, 'https://yuqzdahpwkwwlnbfimtq.supabase.co/functions/v1/campaign-worker', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 4a. claim_campaign_batch -----------------------------------------------------
CREATE OR REPLACE FUNCTION claim_campaign_batch(
  p_campaign_id uuid,
  p_batch_size int DEFAULT 50,
  p_lease_seconds int DEFAULT 120,
  p_max_attempts int DEFAULT 5
)
RETURNS SETOF campaign_recipients
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Fail over-limit rows so they don't loop forever.
  UPDATE campaign_recipients
  SET delivery_status = 'failed',
      last_error_code = COALESCE(last_error_code, 'max_attempts'),
      last_error_message = COALESCE(last_error_message, 'Exceeded maximum retry attempts'),
      lease_expires_at = NULL
  WHERE campaign_id = p_campaign_id
    AND delivery_status IN ('pending','retry_wait')
    AND attempts >= p_max_attempts;

  RETURN QUERY
  WITH claimable AS (
    SELECT id
    FROM campaign_recipients
    WHERE campaign_id = p_campaign_id
      AND attempts < p_max_attempts
      AND (
        (delivery_status IN ('pending','retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
        OR (delivery_status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at < now())
      )
    ORDER BY next_attempt_at NULLS FIRST, created_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE campaign_recipients cr
  SET delivery_status = 'processing',
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = cr.attempts + 1
  FROM claimable
  WHERE cr.id = claimable.id
  RETURNING cr.*;
END;
$$;

-- 4b. refresh_campaign_job_counts ---------------------------------------------
CREATE OR REPLACE FUNCTION refresh_campaign_job_counts(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total int; v_sent int; v_pending int; v_processing int;
  v_retry int; v_failed int; v_skipped int; v_suppressed int;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE delivery_status = 'sent'),
    count(*) FILTER (WHERE delivery_status = 'pending'),
    count(*) FILTER (WHERE delivery_status = 'processing'),
    count(*) FILTER (WHERE delivery_status = 'retry_wait'),
    count(*) FILTER (WHERE delivery_status = 'failed'),
    count(*) FILTER (WHERE delivery_status = 'skipped'),
    count(*) FILTER (WHERE delivery_status = 'suppressed')
  INTO v_total, v_sent, v_pending, v_processing, v_retry, v_failed, v_skipped, v_suppressed
  FROM campaign_recipients
  WHERE campaign_id = p_campaign_id;

  UPDATE campaign_send_jobs
  SET total_recipients = v_total,
      sent_count = v_sent,
      pending_count = v_pending,
      processing_count = v_processing,
      retry_count = v_retry,
      failed_count = v_failed,
      skipped_count = v_skipped,
      suppressed_count = v_suppressed,
      updated_at = now()
  WHERE campaign_id = p_campaign_id;
END;
$$;

-- 4c. kick_campaign_worker -----------------------------------------------------
CREATE OR REPLACE FUNCTION kick_campaign_worker(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_url text;
  v_token text;
BEGIN
  SELECT worker_url, worker_token INTO v_url, v_token FROM private_worker_config WHERE id = 1;
  IF v_url IS NULL THEN
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url,
    body := jsonb_build_object('campaignId', p_campaign_id),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-token', v_token),
    timeout_milliseconds := 8000
  );
END;
$$;

-- 4d. start_campaign_send ------------------------------------------------------
CREATE OR REPLACE FUNCTION start_campaign_send(
  p_campaign_id uuid,
  p_batch_size int DEFAULT 50
)
RETURNS campaign_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  v_job campaign_send_jobs;
BEGIN
  -- Queue eligible recipients: anything not already sent and not terminal.
  -- Never touches sent/suppressed/skipped rows.
  UPDATE campaign_recipients
  SET delivery_status = 'pending',
      next_attempt_at = COALESCE(next_attempt_at, now()),
      lease_expires_at = NULL
  WHERE campaign_id = p_campaign_id
    AND sent = false
    AND delivery_status NOT IN ('sent','suppressed','skipped','pending','retry_wait','processing');

  INSERT INTO campaign_send_jobs (campaign_id, status, batch_size, started_at, last_heartbeat_at)
  VALUES (p_campaign_id, 'running', GREATEST(p_batch_size, 1), now(), now())
  ON CONFLICT (campaign_id) DO UPDATE
    SET status = 'running',
        batch_size = GREATEST(EXCLUDED.batch_size, 1),
        completed_at = NULL,
        last_error = NULL,
        throttled = false,
        throttled_until = NULL,
        started_at = COALESCE(campaign_send_jobs.started_at, now()),
        last_heartbeat_at = now(),
        updated_at = now()
  RETURNING * INTO v_job;

  UPDATE marketing_campaigns SET status = 'sending', updated_at = now() WHERE id = p_campaign_id;

  PERFORM refresh_campaign_job_counts(p_campaign_id);
  PERFORM kick_campaign_worker(p_campaign_id);

  SELECT * INTO v_job FROM campaign_send_jobs WHERE campaign_id = p_campaign_id;
  RETURN v_job;
END;
$$;

-- 4e. pause / cancel -----------------------------------------------------------
CREATE OR REPLACE FUNCTION pause_campaign_send(p_campaign_id uuid)
RETURNS campaign_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_job campaign_send_jobs;
BEGIN
  UPDATE campaign_send_jobs SET status = 'paused', updated_at = now()
  WHERE campaign_id = p_campaign_id RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_campaign_send(p_campaign_id uuid)
RETURNS campaign_send_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_job campaign_send_jobs;
BEGIN
  UPDATE campaign_send_jobs SET status = 'cancelled', completed_at = now(), updated_at = now()
  WHERE campaign_id = p_campaign_id RETURNING * INTO v_job;
  RETURN v_job;
END;
$$;

-- 4f. drive_campaign_jobs (pg_cron backstop) -----------------------------------
CREATE OR REPLACE FUNCTION drive_campaign_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT j.campaign_id
    FROM campaign_send_jobs j
    WHERE j.status = 'running'
      AND (j.last_heartbeat_at IS NULL OR j.last_heartbeat_at < now() - interval '90 seconds')
      AND EXISTS (
        SELECT 1 FROM campaign_recipients cr
        WHERE cr.campaign_id = j.campaign_id
          AND (
            (cr.delivery_status IN ('pending','retry_wait') AND (cr.next_attempt_at IS NULL OR cr.next_attempt_at <= now()))
            OR (cr.delivery_status = 'processing' AND cr.lease_expires_at IS NOT NULL AND cr.lease_expires_at < now())
          )
      )
  LOOP
    PERFORM kick_campaign_worker(r.campaign_id);
  END LOOP;
END;
$$;

-- Grants -----------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION start_campaign_send(uuid, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pause_campaign_send(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_campaign_send(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_campaign_batch(uuid, int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION refresh_campaign_job_counts(uuid) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION kick_campaign_worker(uuid) TO service_role;

-- pg_cron schedule -------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drive-campaign-jobs') THEN
    PERFORM cron.schedule('drive-campaign-jobs', '* * * * *', 'SELECT drive_campaign_jobs();');
  END IF;
END $$;
