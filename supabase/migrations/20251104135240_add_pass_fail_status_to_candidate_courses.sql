/*
  # Add Pass/Fail Status to Candidate Courses

  1. Changes
    - Add `result` column to `candidate_courses` table
      - Options: 'pending', 'passed', 'failed'
      - Default: 'pending'
    - This provides an explicit field to track whether a candidate passed or failed their course
    - Works alongside the existing `status` field which tracks enrollment/completion status

  2. Notes
    - Existing records will default to 'pending'
    - The `status` field tracks the enrollment state (enrolled, in_progress, completed, cancelled)
    - The new `result` field tracks the pass/fail outcome
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_courses' AND column_name = 'result'
  ) THEN
    ALTER TABLE candidate_courses ADD COLUMN result text DEFAULT 'pending';
  END IF;
END $$;