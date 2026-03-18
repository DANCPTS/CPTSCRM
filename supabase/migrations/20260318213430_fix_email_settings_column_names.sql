/*
  # Fix email_settings column names and constraints

  1. Modified Tables
    - `email_settings`
      - Rename `smtp_user` to `smtp_username`
      - Rename `smtp_pass` to `smtp_password`
      - Add UNIQUE constraint on `settings_type` for upsert support

  2. Notes
    - Column names must match what the application expects
    - The unique constraint on settings_type allows using upsert with onConflict
*/

ALTER TABLE email_settings RENAME COLUMN smtp_user TO smtp_username;
ALTER TABLE email_settings RENAME COLUMN smtp_pass TO smtp_password;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'email_settings_settings_type_key'
  ) THEN
    ALTER TABLE email_settings ADD CONSTRAINT email_settings_settings_type_key UNIQUE (settings_type);
  END IF;
END $$;
