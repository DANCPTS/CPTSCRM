/*
  # Add Comprehensive Email Tracking

  1. Changes to campaign_recipients
    - `clicked_at` (timestamptz) - First click timestamp
    - `click_count` (integer) - Total number of clicks
    - `bounced_at` (timestamptz) - When email bounced
    - `bounce_type` (text) - 'hard' or 'soft' bounce
    - `unsubscribed_at` (timestamptz) - When recipient unsubscribed
    - `spam_reported_at` (timestamptz) - When reported as spam
    - `delivery_status` (text) - 'pending', 'delivered', 'bounced', 'failed'

  2. New Table: email_link_clicks
    - Tracks individual link clicks with URL and timestamp
    - Allows detailed link activity analysis

  3. New Table: unsubscribed_emails
    - Global unsubscribe list to prevent future emails
    - Stores reason for unsubscribe

  4. Indexes
    - Added indexes for efficient reporting queries
*/

ALTER TABLE campaign_recipients
ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
ADD COLUMN IF NOT EXISTS bounce_type text CHECK (bounce_type IS NULL OR bounce_type IN ('hard', 'soft')),
ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
ADD COLUMN IF NOT EXISTS spam_reported_at timestamptz,
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'bounced', 'failed'));

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_clicked_at
ON campaign_recipients(clicked_at)
WHERE clicked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_bounced_at
ON campaign_recipients(bounced_at)
WHERE bounced_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_unsubscribed_at
ON campaign_recipients(unsubscribed_at)
WHERE unsubscribed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_spam_reported_at
ON campaign_recipients(spam_reported_at)
WHERE spam_reported_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES campaign_recipients(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE email_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view email link clicks"
  ON email_link_clicks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert from edge functions"
  ON email_link_clicks FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_link_clicks_recipient_id ON email_link_clicks(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_link_clicks_campaign_id ON email_link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_link_clicks_clicked_at ON email_link_clicks(clicked_at);

CREATE TABLE IF NOT EXISTS unsubscribed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  reason text,
  unsubscribed_at timestamptz DEFAULT now()
);

ALTER TABLE unsubscribed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view unsubscribed emails"
  ON unsubscribed_emails FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow insert from edge functions"
  ON unsubscribed_emails FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_unsubscribed_emails_email ON unsubscribed_emails(email);

CREATE OR REPLACE FUNCTION increment_recipient_click_count(recipient_id uuid, link_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM campaign_recipients
  WHERE id = recipient_id;

  UPDATE campaign_recipients
  SET 
    click_count = click_count + 1,
    clicked_at = COALESCE(clicked_at, now())
  WHERE id = recipient_id;

  IF v_campaign_id IS NOT NULL THEN
    INSERT INTO email_link_clicks (recipient_id, campaign_id, url)
    VALUES (recipient_id, v_campaign_id, link_url);
  END IF;
END;
$$;