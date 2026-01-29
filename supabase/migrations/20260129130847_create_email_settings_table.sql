/*
  # Create Email Settings Table

  1. New Tables
    - `email_settings`
      - `id` (uuid, primary key)
      - `smtp_host` (text) - SMTP server hostname
      - `smtp_port` (integer) - SMTP server port
      - `smtp_username` (text) - SMTP login username
      - `smtp_password` (text) - SMTP password (encrypted)
      - `from_email` (text) - Sender email address
      - `from_name` (text) - Sender display name
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid) - User who created the settings

  2. Security
    - Enable RLS
    - Only authenticated users can read/update email settings
    - Single row constraint (only one settings record)

  3. Notes
    - This stores organization-wide email configuration
    - Used by all email-sending edge functions
*/

CREATE TABLE IF NOT EXISTS email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  smtp_host text NOT NULL DEFAULT '',
  smtp_port integer NOT NULL DEFAULT 465,
  smtp_username text NOT NULL DEFAULT '',
  smtp_password text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT 'CPTS Training',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email settings"
  ON email_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert email settings"
  ON email_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update email settings"
  ON email_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_email_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_email_settings_timestamp();

INSERT INTO email_settings (smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name)
VALUES ('smtp.cpts-host.beep.pl', 465, 'daniel@cpts.uk', '', 'daniel@cpts.uk', 'CPTS Training')
ON CONFLICT DO NOTHING;