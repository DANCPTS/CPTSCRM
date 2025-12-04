/*
  # Add Theory and Practical Test Times to Attendance

  1. Changes
    - Replace `test_time` with `theory_test_time` and `practical_test_time`
    - This allows tracking separate times for theory and practical tests (required for CPCS)
  
  2. Notes
    - CPCS courses require both theory and practical test scheduling
    - Other courses can use either field as needed
*/

DO $$
BEGIN
  -- Add theory_test_time column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'theory_test_time'
  ) THEN
    ALTER TABLE attendance ADD COLUMN theory_test_time time;
  END IF;

  -- Add practical_test_time column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'practical_test_time'
  ) THEN
    ALTER TABLE attendance ADD COLUMN practical_test_time time;
  END IF;

  -- Migrate existing test_time data to practical_test_time if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'test_time'
  ) THEN
    UPDATE attendance 
    SET practical_test_time = test_time 
    WHERE test_time IS NOT NULL AND practical_test_time IS NULL;
    
    -- Drop old test_time column
    ALTER TABLE attendance DROP COLUMN IF EXISTS test_time;
  END IF;
END $$;