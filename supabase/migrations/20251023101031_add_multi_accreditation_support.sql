/*
  # Add Multi-Accreditation Support to Courses

  ## Changes
  
  1. Courses Table
    - Change `accreditation` from single value to array of text
    - Remove `price_per_person` (will be moved to accreditation-specific pricing)
    - Add `available_accreditations` array field
  
  2. New Table: `course_accreditation_pricing`
    - Links courses to specific accreditation prices
    - Allows same course to have different prices for CPCS vs NPORS
  
  3. Bookings Table
    - Add `accreditation` field to track which accreditation the candidate is booking
    - Update amount calculation to use accreditation-specific pricing
  
  ## Usage
  
  - When creating a course, select multiple accreditations (e.g., CPCS and NPORS)
  - Set individual prices for each accreditation
  - When booking, candidate selects which accreditation they want
  - Price is automatically set based on selected accreditation
*/

-- Drop the existing check constraint on courses.accreditation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'courses_accreditation_check' 
    AND table_name = 'courses'
  ) THEN
    ALTER TABLE courses DROP CONSTRAINT courses_accreditation_check;
  END IF;
END $$;

-- Change accreditation to array and make price_per_person nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'accreditation'
    AND data_type != 'ARRAY'
  ) THEN
    ALTER TABLE courses 
      ALTER COLUMN accreditation DROP NOT NULL,
      ALTER COLUMN accreditation TYPE text[] USING ARRAY[accreditation],
      ALTER COLUMN accreditation SET DEFAULT ARRAY['CPCS']::text[];
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' 
    AND column_name = 'price_per_person'
  ) THEN
    ALTER TABLE courses ALTER COLUMN price_per_person DROP NOT NULL;
  END IF;
END $$;

-- Create course_accreditation_pricing table
CREATE TABLE IF NOT EXISTS course_accreditation_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  accreditation text NOT NULL CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC')),
  price decimal(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(course_id, accreditation)
);

ALTER TABLE course_accreditation_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view course pricing"
  ON course_accreditation_pricing FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert course pricing"
  ON course_accreditation_pricing FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update course pricing"
  ON course_accreditation_pricing FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete course pricing"
  ON course_accreditation_pricing FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Add accreditation field to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' 
    AND column_name = 'accreditation'
  ) THEN
    ALTER TABLE bookings 
      ADD COLUMN accreditation text CHECK (accreditation IN ('CPCS', 'NPORS', 'IPAF', 'ETC'));
  END IF;
END $$;
