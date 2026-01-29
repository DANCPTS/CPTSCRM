/*
  # Add Source Tracking to Campaign Recipients

  1. Changes
    - Add `source` column to `campaign_recipients` table
    - Values: 'candidate', 'contact', 'excel_upload'
    - Helps track where recipients were added from

  2. Notes
    - Existing recipients will have NULL source (considered legacy data)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'campaign_recipients' AND column_name = 'source'
  ) THEN
    ALTER TABLE campaign_recipients ADD COLUMN source text;
  END IF;
END $$;