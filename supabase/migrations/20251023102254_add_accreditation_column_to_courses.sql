/*
  # Add accreditation column to courses table

  ## Changes
  
  1. Courses Table
    - Add `accreditation` column as text array
    - This stores which accreditations are available for this course
    - Default to empty array
*/

-- Add accreditation column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE courses 
      ADD COLUMN accreditation text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;
