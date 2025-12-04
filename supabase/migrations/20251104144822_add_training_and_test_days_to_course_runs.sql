/*
  # Add Training and Test Days to Course Runs

  1. New Columns
    - `training_days` (date[]) - Array of training days for the course
    - `test_days` (date[]) - Array of test/assessment days for the course

  2. Changes
    - Add training_days column to course_runs table
    - Add test_days column to course_runs table
    - These allow flexible scheduling where training days show as green and test days show as red on the calendar

  3. Notes
    - start_date and end_date remain for overall course duration
    - training_days and test_days provide granular day-by-day control
    - If arrays are empty, falls back to showing the entire date range
*/

-- Add training_days and test_days columns to course_runs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_runs' AND column_name = 'training_days'
  ) THEN
    ALTER TABLE course_runs ADD COLUMN training_days date[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_runs' AND column_name = 'test_days'
  ) THEN
    ALTER TABLE course_runs ADD COLUMN test_days date[] DEFAULT '{}';
  END IF;
END $$;