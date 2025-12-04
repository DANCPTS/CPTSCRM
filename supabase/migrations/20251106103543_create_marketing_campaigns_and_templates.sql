/*
  # Create Marketing Campaigns and Email Templates

  1. New Tables
    - `email_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Template name
      - `subject` (text) - Email subject line
      - `body` (text) - Email body content (HTML/text)
      - `category` (text) - What the marketing is about
      - `created_by` (uuid) - User who created the template
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `marketing_campaigns`
      - `id` (uuid, primary key)
      - `name` (text) - Campaign name
      - `target_type` (text) - 'business' or 'individual'
      - `template_id` (uuid) - FK to email_templates
      - `status` (text) - 'draft', 'scheduled', 'sent'
      - `scheduled_at` (timestamp) - When to send (null for immediate)
      - `sent_at` (timestamp) - When it was actually sent
      - `recipients_count` (integer) - Total number of recipients
      - `created_by` (uuid) - User who created the campaign
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `campaign_recipients`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid) - FK to marketing_campaigns
      - `email` (text) - Recipient email
      - `name` (text) - Recipient name
      - `company_name` (text, nullable) - For business recipients
      - `sent` (boolean) - Whether email was sent
      - `sent_at` (timestamp) - When it was sent
      - `opened` (boolean) - Whether email was opened
      - `opened_at` (timestamp) - When it was opened
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their campaigns
*/

-- Create email templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all email templates"
  ON email_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create email templates"
  ON email_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own email templates"
  ON email_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own email templates"
  ON email_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('business', 'individual')),
  template_id uuid REFERENCES email_templates(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipients_count integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all campaigns"
  ON marketing_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create campaigns"
  ON marketing_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update campaigns"
  ON marketing_campaigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete own campaigns"
  ON marketing_campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create campaign recipients table
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES marketing_campaigns(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  company_name text,
  sent boolean DEFAULT false,
  sent_at timestamptz,
  opened boolean DEFAULT false,
  opened_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaign recipients"
  ON campaign_recipients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create campaign recipients"
  ON campaign_recipients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update campaign recipients"
  ON campaign_recipients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete campaign recipients"
  ON campaign_recipients FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_created_by ON marketing_campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_sent ON campaign_recipients(sent);
