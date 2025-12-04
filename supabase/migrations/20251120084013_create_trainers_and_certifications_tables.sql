/*
  # Create Trainers and Certifications Tables

  ## Changes
  1. New Tables
    - `trainers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users) - links to system user if they have login access
      - `first_name` (text, required)
      - `last_name` (text, required)
      - `email` (text, unique)
      - `phone` (text)
      - `address` (text)
      - `date_of_birth` (date)
      - `emergency_contact_name` (text)
      - `emergency_contact_phone` (text)
      - `notes` (text)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to users)

    - `trainer_certifications`
      - `id` (uuid, primary key)
      - `trainer_id` (uuid, foreign key to trainers)
      - `certification_name` (text, required) - e.g., "CPCS Instructor", "NPORS Tester"
      - `certification_number` (text)
      - `issuing_organization` (text)
      - `issue_date` (date)
      - `expiry_date` (date)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage trainers
    - Add policies for authenticated users to manage certifications

  3. Indexes
    - Index on trainer email for faster lookups
    - Index on trainer user_id for linking
    - Index on certification trainer_id for faster queries
*/

-- Create trainers table
CREATE TABLE IF NOT EXISTS trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE,
  phone text,
  address text,
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Create trainer_certifications table
CREATE TABLE IF NOT EXISTS trainer_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id uuid NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
  certification_name text NOT NULL,
  certification_number text,
  issuing_organization text,
  issue_date date,
  expiry_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trainers_email ON trainers(email);
CREATE INDEX IF NOT EXISTS idx_trainers_user_id ON trainers(user_id);
CREATE INDEX IF NOT EXISTS idx_trainers_is_active ON trainers(is_active);
CREATE INDEX IF NOT EXISTS idx_trainer_certifications_trainer_id ON trainer_certifications(trainer_id);
CREATE INDEX IF NOT EXISTS idx_trainer_certifications_expiry ON trainer_certifications(expiry_date);

-- Enable RLS
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_certifications ENABLE ROW LEVEL SECURITY;

-- Trainers policies
CREATE POLICY "Authenticated users can view trainers"
  ON trainers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trainers"
  ON trainers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update trainers"
  ON trainers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete trainers"
  ON trainers FOR DELETE
  TO authenticated
  USING (true);

-- Trainer certifications policies
CREATE POLICY "Authenticated users can view certifications"
  ON trainer_certifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert certifications"
  ON trainer_certifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update certifications"
  ON trainer_certifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete certifications"
  ON trainer_certifications FOR DELETE
  TO authenticated
  USING (true);
