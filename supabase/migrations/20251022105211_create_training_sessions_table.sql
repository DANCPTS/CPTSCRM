/*
  # Create Training Sessions Table

  1. New Tables
    - `training_sessions`
      - `id` (uuid, primary key)
      - `title` (text) - Name of the training session
      - `description` (text, optional) - Details about the session
      - `start_date` (date) - Start date of the training
      - `end_date` (date) - End date of the training
      - `start_time` (time, optional) - Start time for the session
      - `end_time` (time, optional) - End time for the session
      - `color` (text) - Color code for display (e.g., 'blue', 'green', 'red')
      - `training_type` (text, optional) - Type of training (e.g., 'CPCS', 'NPORS')
      - `location` (text, optional) - Where the training takes place
      - `trainer_id` (uuid, optional) - Foreign key to users table
      - `capacity` (integer, optional) - Maximum number of participants
      - `enrolled_count` (integer, default 0) - Current number of enrolled participants
      - `status` (text, default 'scheduled') - Status: scheduled, in_progress, completed, cancelled
      - `notes` (text, optional) - Additional notes
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `training_sessions` table
    - Add policy for authenticated users to view all training sessions
    - Add policy for authenticated users to create training sessions
    - Add policy for authenticated users to update their own training sessions
    - Add policy for authenticated users to delete their own training sessions
*/

CREATE TABLE IF NOT EXISTS training_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time,
  end_time time,
  color text NOT NULL DEFAULT 'blue',
  training_type text,
  location text,
  trainer_id uuid REFERENCES users(id),
  capacity integer,
  enrolled_count integer DEFAULT 0,
  status text DEFAULT 'scheduled',
  notes text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all training sessions"
  ON training_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create training sessions"
  ON training_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update training sessions"
  ON training_sessions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete training sessions"
  ON training_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_training_sessions_dates ON training_sessions(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_training_sessions_created_by ON training_sessions(created_by);