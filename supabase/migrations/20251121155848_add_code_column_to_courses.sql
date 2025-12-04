/*
  # Add code column to courses table

  1. Changes
    - Add `code` column to `courses` table
    - Set a default value for existing records
    - Make it optional for new records

  2. Notes
    - Existing courses will get a code generated from their title
    - New courses can specify a code or it will be auto-generated
*/

-- Add code column to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'code'
  ) THEN
    ALTER TABLE courses ADD COLUMN code text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Update existing records with a code based on title
UPDATE courses
SET code = UPPER(SUBSTRING(title, 1, 10))
WHERE code = '' OR code IS NULL;