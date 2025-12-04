/*
  # Add Test Time to Attendance

  1. Changes
    - Add `test_time` column to `attendance` table for tracking scheduled test times
      - Format: time (HH:MM:SS)
      - Optional field, only used for test days
  
  2. Notes
    - This allows tracking when a candidate is scheduled to take their test
    - Accreditation sites need to be notified of test times
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'test_time'
  ) THEN
    ALTER TABLE attendance ADD COLUMN test_time time;
  END IF;
END $$;