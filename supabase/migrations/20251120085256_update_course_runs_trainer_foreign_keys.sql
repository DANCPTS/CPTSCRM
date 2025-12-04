/*
  # Update Course Runs Trainer Foreign Keys

  ## Changes
  1. Update Foreign Keys
    - Drop existing foreign keys from `course_runs.trainer_id` and `course_runs.tester_id` pointing to `users`
    - Add new foreign keys pointing to `trainers` table instead
    
  2. Notes
    - This allows course runs to reference trainers from the dedicated trainers table
    - Existing data will be preserved but trainer_id/tester_id values that don't match trainers will be set to NULL
*/

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
  -- Drop trainer_id foreign key if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%course_runs_trainer_id_fkey%'
    AND table_name = 'course_runs'
  ) THEN
    ALTER TABLE course_runs DROP CONSTRAINT IF EXISTS course_runs_trainer_id_fkey;
  END IF;

  -- Drop tester_id foreign key if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%course_runs_tester_id_fkey%'
    AND table_name = 'course_runs'
  ) THEN
    ALTER TABLE course_runs DROP CONSTRAINT IF EXISTS course_runs_tester_id_fkey;
  END IF;
END $$;

-- Clear any trainer_id/tester_id values that don't exist in trainers table
UPDATE course_runs SET trainer_id = NULL WHERE trainer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = course_runs.trainer_id);
UPDATE course_runs SET tester_id = NULL WHERE tester_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = course_runs.tester_id);

-- Add new foreign keys pointing to trainers table
ALTER TABLE course_runs
  ADD CONSTRAINT course_runs_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;

ALTER TABLE course_runs
  ADD CONSTRAINT course_runs_tester_id_fkey
  FOREIGN KEY (tester_id) REFERENCES trainers(id) ON DELETE SET NULL;
