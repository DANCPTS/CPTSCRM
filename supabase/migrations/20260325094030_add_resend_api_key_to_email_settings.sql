/*
  # Add Resend API Key to Email Settings

  1. Modified Tables
    - `email_settings`
      - Added `resend_api_key` (text) - Stores the Resend API key for marketing email sending
  
  2. Notes
    - Marketing campaigns will now use Resend API instead of SMTP
    - Transactional emails (booking forms, joining instructions, payment links) continue using SMTP
    - The SMTP fields remain on the marketing row for backward compatibility but are no longer used for sending
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_settings' AND column_name = 'resend_api_key'
  ) THEN
    ALTER TABLE email_settings ADD COLUMN resend_api_key text NOT NULL DEFAULT '';
  END IF;
END $$;
