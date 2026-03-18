/*
  # Add replied tracking to campaign recipients

  1. Modified Tables
    - `campaign_recipients`
      - `replied_at` (timestamptz, nullable) - timestamp when recipient replied to the email

  2. Notes
    - This is a manually-toggled field since inbound reply detection requires a mail server webhook
    - Users can mark recipients as "replied" from the campaign report
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_recipients' AND column_name = 'replied_at'
  ) THEN
    ALTER TABLE campaign_recipients ADD COLUMN replied_at timestamptz;
  END IF;
END $$;