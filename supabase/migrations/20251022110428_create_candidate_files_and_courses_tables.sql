/*
  # Create Candidate Files and Courses Tables

  1. New Tables
    - `candidate_files`
      - `id` (uuid, primary key)
      - `candidate_id` (uuid) - Foreign key to candidates table
      - `file_name` (text) - Original file name
      - `file_type` (text) - MIME type
      - `file_size` (integer) - File size in bytes
      - `file_url` (text) - URL to the file in storage
      - `storage_path` (text) - Path in Supabase storage
      - `description` (text) - Optional description
      - `uploaded_by` (uuid) - Foreign key to users table
      - `uploaded_at` (timestamptz)

    - `candidate_courses`
      - `id` (uuid, primary key)
      - `candidate_id` (uuid) - Foreign key to candidates table
      - `course_id` (uuid) - Foreign key to courses table
      - `training_session_id` (uuid, optional) - Foreign key to training_sessions table
      - `enrollment_date` (date) - When they enrolled
      - `completion_date` (date, optional) - When they completed
      - `status` (text, default 'enrolled') - Status: enrolled, in_progress, completed, failed, cancelled
      - `grade` (text, optional) - Grade received
      - `certificate_number` (text, optional) - Certificate number if issued
      - `notes` (text) - Additional notes
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage files and course enrollments
*/

CREATE TABLE IF NOT EXISTS candidate_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  file_url text NOT NULL,
  storage_path text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES users(id) NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidate files"
  ON candidate_files
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload candidate files"
  ON candidate_files
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete candidate files"
  ON candidate_files
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidate_files_candidate_id ON candidate_files(candidate_id);

CREATE TABLE IF NOT EXISTS candidate_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  training_session_id uuid REFERENCES training_sessions(id) ON DELETE SET NULL,
  enrollment_date date NOT NULL DEFAULT CURRENT_DATE,
  completion_date date,
  status text DEFAULT 'enrolled',
  grade text,
  certificate_number text,
  notes text,
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE candidate_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidate courses"
  ON candidate_courses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create candidate courses"
  ON candidate_courses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update candidate courses"
  ON candidate_courses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete candidate courses"
  ON candidate_courses
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidate_courses_candidate_id ON candidate_courses(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_courses_course_id ON candidate_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_candidate_courses_training_session_id ON candidate_courses(training_session_id);