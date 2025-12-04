/*
  # Add course run reference to candidate courses

  1. Changes
    - Add `course_run_id` column to `candidate_courses` table
    - This links candidates to specific course run dates
    - Makes the foreign key nullable since existing records don't have this

  2. Notes
    - Existing records will have NULL course_run_id
    - Future records should populate this field
*/

-- Add course_run_id column to candidate_courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_courses' AND column_name = 'course_run_id'
  ) THEN
    ALTER TABLE candidate_courses 
    ADD COLUMN course_run_id uuid REFERENCES course_runs(id);
  END IF;
END $$;
