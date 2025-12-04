/*
  # Add Trainer and Tester Assignment to Course Runs

  ## Changes
  1. Changes
    - Drop existing `trainer` text column from `course_runs`
    - Add `trainer_id` column (foreign key to users table) for training instructor
    - Add `tester_id` column (foreign key to users table) for test examiner
  
  2. Why
    - Allows assigning specific users as trainers for training days
    - Allows assigning specific users as testers for test days
    - Supports different people for training vs testing roles
    - Enables displaying trainer/tester names on calendar view

  3. Security
    - No RLS changes needed (inherits existing course_runs policies)
*/

-- Drop old text trainer column
ALTER TABLE course_runs DROP COLUMN IF EXISTS trainer;

-- Add trainer_id and tester_id as foreign keys
ALTER TABLE course_runs 
  ADD COLUMN IF NOT EXISTS trainer_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS tester_id uuid REFERENCES users(id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_course_runs_trainer ON course_runs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_course_runs_tester ON course_runs(tester_id);
