/*
  # Create Attendance Tracking Table

  1. New Tables
    - `attendance`
      - `id` (uuid, primary key)
      - `candidate_course_id` (uuid, references candidate_courses)
      - `date` (date) - the specific date of attendance
      - `status` (text) - present, absent, late, excused
      - `notes` (text) - optional notes about attendance
      - `marked_by` (uuid, references users) - who marked the attendance
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `attendance` table
    - Add policies for authenticated users to manage attendance
    - Only authenticated users can view and mark attendance

  3. Indexes
    - Index on candidate_course_id for fast lookups
    - Index on date for filtering by date range
*/

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_course_id uuid REFERENCES candidate_courses(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  notes text,
  marked_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(candidate_course_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_candidate_course ON attendance(candidate_course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can mark attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = marked_by);

CREATE POLICY "Authenticated users can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (auth.uid() = marked_by);

CREATE POLICY "Authenticated users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);
