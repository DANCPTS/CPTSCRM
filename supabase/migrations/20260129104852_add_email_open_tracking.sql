/*
  # Add Email Open Tracking

  1. Changes
    - Add `opened_at` timestamp column to campaign_recipients table
    - Add `open_count` integer to track multiple opens
    - Add index for faster queries on opened_at

  2. Notes
    - opened_at records the first time the email was opened
    - open_count tracks total opens (useful for seeing engagement)
*/

ALTER TABLE campaign_recipients
ADD COLUMN IF NOT EXISTS opened_at timestamptz,
ADD COLUMN IF NOT EXISTS open_count integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_opened_at
ON campaign_recipients(opened_at)
WHERE opened_at IS NOT NULL;