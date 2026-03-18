/*
  # Add Missing Email Tracking Infrastructure

  This migration creates tables and columns that are referenced by the application
  but were not present in the database.

  1. New Tables
    - `unsubscribed_emails` - Global unsubscribe list
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `campaign_id` (uuid, nullable FK to marketing_campaigns)
      - `reason` (text, nullable)
      - `unsubscribed_at` (timestamptz)
    - `email_link_clicks` - Tracks individual link clicks
      - `id` (uuid, primary key)
      - `recipient_id` (uuid, FK to campaign_recipients)
      - `campaign_id` (uuid, FK to marketing_campaigns)
      - `url` (text)
      - `clicked_at` (timestamptz)
    - `email_settings` - SMTP configuration
      - `id` (uuid, primary key)
      - `settings_type` (text)
      - Various SMTP config fields

  2. Modified Tables
    - `campaign_recipients` - Add tracking columns:
      - `open_count` (integer)
      - `clicked_at` (timestamptz)
      - `click_count` (integer)
      - `bounced_at` (timestamptz)
      - `bounce_type` (text)
      - `unsubscribed_at` (timestamptz)
      - `spam_reported_at` (timestamptz)
      - `delivery_status` (text)
      - `source` (text)

  3. Security
    - RLS enabled on all new tables
    - Appropriate policies for authenticated and anonymous users

  4. Functions
    - `increment_recipient_open_count` - Increments open tracking
    - `increment_recipient_click_count` - Increments click tracking
*/

-- Add missing columns to campaign_recipients
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'open_count') THEN
    ALTER TABLE campaign_recipients ADD COLUMN open_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'clicked_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN clicked_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'click_count') THEN
    ALTER TABLE campaign_recipients ADD COLUMN click_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'bounced_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN bounced_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'bounce_type') THEN
    ALTER TABLE campaign_recipients ADD COLUMN bounce_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'unsubscribed_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN unsubscribed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'spam_reported_at') THEN
    ALTER TABLE campaign_recipients ADD COLUMN spam_reported_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'delivery_status') THEN
    ALTER TABLE campaign_recipients ADD COLUMN delivery_status text NOT NULL DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_recipients' AND column_name = 'source') THEN
    ALTER TABLE campaign_recipients ADD COLUMN source text;
  END IF;
END $$;

-- Create unsubscribed_emails table
CREATE TABLE IF NOT EXISTS unsubscribed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  reason text,
  unsubscribed_at timestamptz DEFAULT now()
);

ALTER TABLE unsubscribed_emails ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unsubscribed_emails' AND policyname = 'Authenticated users can view unsubscribed emails') THEN
    CREATE POLICY "Authenticated users can view unsubscribed emails"
      ON unsubscribed_emails FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unsubscribed_emails' AND policyname = 'Authenticated users can insert unsubscribed emails') THEN
    CREATE POLICY "Authenticated users can insert unsubscribed emails"
      ON unsubscribed_emails FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unsubscribed_emails' AND policyname = 'Anon users can insert unsubscribed emails') THEN
    CREATE POLICY "Anon users can insert unsubscribed emails"
      ON unsubscribed_emails FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unsubscribed_emails' AND policyname = 'Authenticated users can update unsubscribed emails') THEN
    CREATE POLICY "Authenticated users can update unsubscribed emails"
      ON unsubscribed_emails FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'unsubscribed_emails' AND policyname = 'Authenticated users can delete unsubscribed emails') THEN
    CREATE POLICY "Authenticated users can delete unsubscribed emails"
      ON unsubscribed_emails FOR DELETE TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create email_link_clicks table
CREATE TABLE IF NOT EXISTS email_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  url text NOT NULL,
  clicked_at timestamptz DEFAULT now()
);

ALTER TABLE email_link_clicks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_link_clicks' AND policyname = 'Authenticated users can view link clicks') THEN
    CREATE POLICY "Authenticated users can view link clicks"
      ON email_link_clicks FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_link_clicks' AND policyname = 'Anyone can insert link clicks') THEN
    CREATE POLICY "Anyone can insert link clicks"
      ON email_link_clicks FOR INSERT TO authenticated, anon
      WITH CHECK (true);
  END IF;
END $$;

-- Create email_settings table
CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_type text NOT NULL DEFAULT 'marketing',
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_pass text,
  from_email text,
  from_name text,
  reply_to text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'Authenticated users can view email settings') THEN
    CREATE POLICY "Authenticated users can view email settings"
      ON email_settings FOR SELECT TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'Authenticated users can manage email settings') THEN
    CREATE POLICY "Authenticated users can manage email settings"
      ON email_settings FOR INSERT TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'email_settings' AND policyname = 'Authenticated users can update email settings') THEN
    CREATE POLICY "Authenticated users can update email settings"
      ON email_settings FOR UPDATE TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Create increment_recipient_open_count function
CREATE OR REPLACE FUNCTION increment_recipient_open_count(rid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE campaign_recipients
  SET
    open_count = open_count + 1,
    opened_at = COALESCE(opened_at, now())
  WHERE id = rid;
END;
$$;

-- Create increment_recipient_click_count function
CREATE OR REPLACE FUNCTION increment_recipient_click_count(rid uuid, click_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM campaign_recipients WHERE id = rid;

  UPDATE campaign_recipients
  SET
    click_count = click_count + 1,
    clicked_at = COALESCE(clicked_at, now())
  WHERE id = rid;

  INSERT INTO email_link_clicks (recipient_id, campaign_id, url)
  VALUES (rid, v_campaign_id, click_url);
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unsubscribed_emails_email ON unsubscribed_emails(email);
CREATE INDEX IF NOT EXISTS idx_email_link_clicks_recipient ON email_link_clicks(recipient_id);
CREATE INDEX IF NOT EXISTS idx_email_link_clicks_campaign ON email_link_clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_delivery_status ON campaign_recipients(delivery_status);
