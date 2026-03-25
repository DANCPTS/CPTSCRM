/*
  # Add Resend Message ID to Campaign Recipients

  1. Modified Tables
    - `campaign_recipients`
      - Added `resend_message_id` (text) - stores the Resend API message ID for webhook matching
      - Added index on `resend_message_id` for fast webhook lookups

  2. Important Notes
    - This column allows matching incoming Resend webhook events (bounces, spam complaints, delivery confirmations) to the correct recipient record
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_recipients' AND column_name = 'resend_message_id'
  ) THEN
    ALTER TABLE campaign_recipients ADD COLUMN resend_message_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_resend_message_id
  ON campaign_recipients(resend_message_id)
  WHERE resend_message_id IS NOT NULL;