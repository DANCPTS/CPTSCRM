/*
  # Add task_id column to notes table

  1. Changes
    - Add `task_id` column to `notes` table to support linking notes to tasks
    - Add foreign key constraint to ensure referential integrity
  
  2. Security
    - No changes to RLS policies needed - existing policies already cover notes access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE notes ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;