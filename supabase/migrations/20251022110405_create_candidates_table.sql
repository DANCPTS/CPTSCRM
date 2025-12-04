/*
  # Create Candidates Table

  1. New Tables
    - `candidates`
      - `id` (uuid, primary key)
      - `first_name` (text) - Candidate's first name
      - `last_name` (text) - Candidate's last name
      - `email` (text, unique) - Email address
      - `phone` (text) - Phone number
      - `date_of_birth` (date) - Date of birth
      - `address` (text) - Full address
      - `city` (text) - City
      - `postcode` (text) - Postcode
      - `national_insurance_number` (text) - NI number
      - `emergency_contact_name` (text) - Emergency contact name
      - `emergency_contact_phone` (text) - Emergency contact phone
      - `notes` (text) - Additional notes
      - `status` (text, default 'active') - Status: active, inactive, archived
      - `created_by` (uuid) - Foreign key to users table
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `candidates` table
    - Add policy for authenticated users to view all candidates
    - Add policy for authenticated users to create candidates
    - Add policy for authenticated users to update candidates
    - Add policy for authenticated users to delete candidates
*/

CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE,
  phone text,
  date_of_birth date,
  address text,
  city text,
  postcode text,
  national_insurance_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  status text DEFAULT 'active',
  created_by uuid REFERENCES users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all candidates"
  ON candidates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create candidates"
  ON candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update candidates"
  ON candidates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete candidates"
  ON candidates
  FOR DELETE
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON candidates(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);