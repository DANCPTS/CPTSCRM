/*
  # Add settings type to email_settings table

  1. Changes
    - Add `settings_type` column to differentiate between marketing and transactional emails
    - Default existing record to 'transactional'
    - Add unique constraint on settings_type to allow only one record per type
    - Insert default marketing settings row

  2. Notes
    - 'marketing' - Used for marketing campaigns
    - 'transactional' - Used for booking forms, joining instructions, payment links
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_settings' AND column_name = 'settings_type'
  ) THEN
    ALTER TABLE email_settings ADD COLUMN settings_type text NOT NULL DEFAULT 'transactional';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'email_settings_type_unique'
  ) THEN
    CREATE UNIQUE INDEX email_settings_type_unique ON email_settings(settings_type);
  END IF;
END $$;

INSERT INTO email_settings (settings_type, smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name)
SELECT 'marketing', smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name
FROM email_settings
WHERE settings_type = 'transactional'
ON CONFLICT (settings_type) DO NOTHING;