/*
  # Remove Unnecessary Course Fields

  1. Changes
    - Remove `code` column from courses table (unique constraint and column)
    - Remove `category` column from courses table
    - Remove `accreditation` column from courses table
  
  2. Notes
    - These fields are being removed to simplify the course creation process
    - Course runs contain the scheduling information (dates, location, max candidates)
    - Using IF EXISTS to prevent errors if fields are already removed
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'code'
  ) THEN
    ALTER TABLE courses DROP COLUMN code;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'category'
  ) THEN
    ALTER TABLE courses DROP COLUMN category;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE courses DROP COLUMN accreditation;
  END IF;
END $$;
