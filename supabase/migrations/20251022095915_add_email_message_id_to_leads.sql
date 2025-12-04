/*
  # Add email message ID tracking to leads

  1. Changes
    - Add `email_message_id` column to `leads` table to track imported emails
    - Add unique index to prevent duplicate imports
    - Column is nullable for manually created leads

  2. Purpose
    - Prevent duplicate lead creation when checking emails multiple times
    - Track which email message generated each lead
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'email_message_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN email_message_id text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_message_id_unique 
  ON leads(email_message_id) 
  WHERE email_message_id IS NOT NULL;