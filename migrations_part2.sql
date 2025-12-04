 their own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      -- Can update if they can still access the entity
      (lead_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM leads
        WHERE leads.id = notes.lead_id
        AND (leads.assigned_to = auth.uid() OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        ))
      ))
      OR
      (company_id IS NOT NULL OR candidate_id IS NOT NULL OR booking_id IS NOT NULL)
    )
  )
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      -- Can delete if they can still access the entity
      (lead_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM leads
        WHERE leads.id = notes.lead_id
        AND (leads.assigned_to = auth.uid() OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
        ))
      ))
      OR
      (company_id IS NOT NULL OR candidate_id IS NOT NULL OR booking_id IS NOT NULL)
    )
  );


-- ============================================
-- Migration: 20251119093056_document_multi_tenancy_model.sql
-- ============================================

/*
  # Multi-Tenancy Access Control Documentation

  This migration documents the complete access control model for the CRM system.

  ## User-Specific Data (Private per user)

  ### Leads
  - Users can only see leads assigned to them via `assigned_to` field
  - Admins can see all leads
  - When a sales user creates a lead, they're automatically assigned to it
  - Notes on leads follow the same access rules

  ### Tasks  
  - Users can only see tasks assigned to them via `assigned_to` field
  - Admins can see all tasks
  - Already correctly configured in initial schema

  ### Notes (Context-Aware)
  - Notes on leads: only visible to users with access to that lead
  - Notes on shared entities: visible to all authenticated users

  ## Shared Data (Accessible by all authenticated users)

  ### Companies
  - All authenticated users can view companies
  - Sales and admins can create/update companies
  - Only admins can delete companies

  ### Contacts
  - All authenticated users can view contacts
  - Sales and admins can create/update contacts
  - Only admins can delete contacts

  ### Candidates
  - All authenticated users can view candidates
  - Sales and admins can create/update candidates
  - Only admins can delete candidates

  ### Courses & Course Runs
  - All authenticated users can view courses and course runs
  - Sales and admins can create/update course runs
  - Only admins can create/update/delete courses

  ### Bookings
  - All authenticated users can view bookings
  - Sales and admins can create/update bookings
  - Only admins can delete bookings

  ### Training Sessions & Attendance
  - All authenticated users can view training sessions and attendance
  - Sales and admins can create/update records
  - Only admins can delete records

  ## Implementation Notes

  - The `assigned_to` field determines ownership for leads and tasks
  - The `created_by` field tracks who created a record but doesn't control access
  - Admins always have full access to all data
  - Sales users have write access to operational data but not configuration data
*/

-- This migration is documentation-only and makes no schema changes
SELECT 'Multi-tenancy access control model documented' AS status;


-- ============================================
-- Migration: 20251120083052_add_trainer_tester_to_course_runs.sql
-- ============================================

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


-- ============================================
-- Migration: 20251120084013_create_trainers_and_certifications_tables.sql
-- ============================================

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


-- ============================================
-- Migration: 20251120084821_add_certification_file_storage_v2.sql
-- ============================================

/*
  # Add Certification File Storage

  ## Changes
  1. Storage
    - Create `trainer_certifications` bucket for storing certification documents
    - Configure RLS policies for secure file access

  2. Database Updates
    - Add `file_url` column to `trainer_certifications` table
    - Add `file_name` column to store original filename

  3. Security
    - Allow authenticated users to upload files
    - Allow authenticated users to view/download files
    - Files are organized by trainer_id/certification_id
*/

-- Add file columns to trainer_certifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_certifications' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE trainer_certifications ADD COLUMN file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_certifications' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE trainer_certifications ADD COLUMN file_name text;
  END IF;
END $$;

-- Create storage bucket for trainer certifications
INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-certifications', 'trainer-certifications', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete certification files" ON storage.objects;

-- Storage policies for trainer certifications bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload certification files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trainer-certifications');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view certification files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trainer-certifications');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update certification files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trainer-certifications')
  WITH CHECK (bucket_id = 'trainer-certifications');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete certification files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trainer-certifications');


-- ============================================
-- Migration: 20251120085256_update_course_runs_trainer_foreign_keys.sql
-- ============================================

/*
  # Update Course Runs Trainer Foreign Keys

  ## Changes
  1. Update Foreign Keys
    - Drop existing foreign keys from `course_runs.trainer_id` and `course_runs.tester_id` pointing to `users`
    - Add new foreign keys pointing to `trainers` table instead
    
  2. Notes
    - This allows course runs to reference trainers from the dedicated trainers table
    - Existing data will be preserved but trainer_id/tester_id values that don't match trainers will be set to NULL
*/

-- Drop existing foreign key constraints if they exist
DO $$
BEGIN
  -- Drop trainer_id foreign key if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%course_runs_trainer_id_fkey%'
    AND table_name = 'course_runs'
  ) THEN
    ALTER TABLE course_runs DROP CONSTRAINT IF EXISTS course_runs_trainer_id_fkey;
  END IF;

  -- Drop tester_id foreign key if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%course_runs_tester_id_fkey%'
    AND table_name = 'course_runs'
  ) THEN
    ALTER TABLE course_runs DROP CONSTRAINT IF EXISTS course_runs_tester_id_fkey;
  END IF;
END $$;

-- Clear any trainer_id/tester_id values that don't exist in trainers table
UPDATE course_runs SET trainer_id = NULL WHERE trainer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = course_runs.trainer_id);
UPDATE course_runs SET tester_id = NULL WHERE tester_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = course_runs.tester_id);

-- Add new foreign keys pointing to trainers table
ALTER TABLE course_runs
  ADD CONSTRAINT course_runs_trainer_id_fkey
  FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL;

ALTER TABLE course_runs
  ADD CONSTRAINT course_runs_tester_id_fkey
  FOREIGN KEY (tester_id) REFERENCES trainers(id) ON DELETE SET NULL;


-- ============================================
-- Migration: 20251121155848_add_code_column_to_courses.sql
-- ============================================

/*
  # Add code column to courses table

  1. Changes
    - Add `code` column to `courses` table
    - Set a default value for existing records
    - Make it optional for new records

  2. Notes
    - Existing courses will get a code generated from their title
    - New courses can specify a code or it will be auto-generated
*/

-- Add code column to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'code'
  ) THEN
    ALTER TABLE courses ADD COLUMN code text DEFAULT '' NOT NULL;
  END IF;
END $$;

-- Update existing records with a code based on title
UPDATE courses
SET code = UPPER(SUBSTRING(title, 1, 10))
WHERE code = '' OR code IS NULL;

-- ============================================
-- Migration: 20251121161003_create_calendar_settings_table.sql
-- ============================================

/*
  # Create calendar settings table

  1. New Tables
    - `calendar_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users.id)
      - `category` (text) - e.g., 'training', 'test', 'assessment', etc.
      - `color` (text) - color value (blue, green, red, etc.)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `calendar_settings` table
    - Add policies for users to manage their own settings
*/

CREATE TABLE IF NOT EXISTS calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, category)
);

ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calendar settings"
  ON calendar_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar settings"
  ON calendar_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar settings"
  ON calendar_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar settings"
  ON calendar_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Migration: 20251126155057_fix_contact_and_candidate_creation.sql
-- ============================================

/*
  # Fix Contact and Candidate Creation from Booking Forms

  1. Changes
    - Update auto_create_candidates trigger to also create a contact for the booker
    - Candidates should be created with delegate-specific information
    - Booker (contact_name, contact_email, contact_phone) should be added as a contact

  2. Behavior
    - When a booking form is signed:
      - Create a contact for the booker and link to the company
      - Create candidates for each delegate (without booker's email/phone)
      - Link candidates to the course run
*/

CREATE OR REPLACE FUNCTION auto_create_candidates_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_delegate jsonb;
  v_delegate_name text;
  v_first_name text;
  v_last_name text;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_course_name text;
  v_course_id uuid;
  v_course_run_id uuid;
  v_candidate_id uuid;
  v_contact_id uuid;
  v_admin_user_id uuid;
  v_name_parts text[];
  v_ni_number text;
  v_dob text;
  v_address text;
  v_postcode text;
  v_company_id uuid;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the first admin user to use as created_by
    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    -- Extract booker information
    v_contact_name := NEW.form_data->>'contact_name';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';
    
    -- Get company_id from the lead
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO v_company_id
      FROM leads
      WHERE id = NEW.lead_id
      LIMIT 1;
    END IF;
    
    -- Create or update the contact (booker) if we have their information
    IF v_contact_name IS NOT NULL AND trim(v_contact_name) != '' THEN
      -- Parse contact name into first and last name
      v_name_parts := string_to_array(trim(v_contact_name), ' ');
      
      IF array_length(v_name_parts, 1) >= 2 THEN
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
      ELSE
        v_first_name := trim(v_contact_name);
        v_last_name := '';
      END IF;
      
      -- Check if contact already exists by email or name
      IF v_contact_email IS NOT NULL AND trim(v_contact_email) != '' THEN
        SELECT id INTO v_contact_id 
        FROM contacts 
        WHERE lower(email) = lower(trim(v_contact_email))
        LIMIT 1;
      END IF;
      
      IF v_contact_id IS NULL THEN
        SELECT id INTO v_contact_id 
        FROM contacts 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
          AND company_id = v_company_id
        LIMIT 1;
      END IF;
      
      -- Create contact if doesn't exist
      IF v_contact_id IS NULL THEN
        INSERT INTO contacts (
          first_name,
          last_name,
          email,
          phone,
          company_id,
          created_at
        ) VALUES (
          v_first_name,
          v_last_name,
          v_contact_email,
          v_contact_phone,
          v_company_id,
          now()
        )
        RETURNING id INTO v_contact_id;
        
        RAISE NOTICE 'Created contact (booker): % % (ID: %)', v_first_name, v_last_name, v_contact_id;
      ELSE
        -- Update existing contact with new information if provided
        UPDATE contacts
        SET 
          email = COALESCE(v_contact_email, email),
          phone = COALESCE(v_contact_phone, phone),
          company_id = COALESCE(v_company_id, company_id),
          updated_at = now()
        WHERE id = v_contact_id;
        
        RAISE NOTICE 'Updated contact (booker): % % (ID: %)', v_first_name, v_last_name, v_contact_id;
      END IF;
    END IF;
    
    -- Find the course_id based on course name
    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE title ILIKE '%' || v_course_name || '%' LIMIT 1;
    END IF;
    
    -- Try to find the course_run_id from the lead's booking directly
    IF NEW.lead_id IS NOT NULL THEN
      SELECT b.course_run_id INTO v_course_run_id
      FROM bookings b
      WHERE b.lead_id = NEW.lead_id
        AND b.course_run_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT 1;
    END IF;
    
    -- If no course_run found from booking, try to find an upcoming course run for the course
    IF v_course_run_id IS NULL AND v_course_id IS NOT NULL THEN
      SELECT id INTO v_course_run_id
      FROM course_runs
      WHERE course_id = v_course_id
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 1;
    END IF;
    
    -- Process delegates array from form_data
    IF NEW.form_data->'delegates' IS NOT NULL THEN
      FOR v_delegate IN SELECT * FROM jsonb_array_elements(NEW.form_data->'delegates')
      LOOP
        v_delegate_name := v_delegate->>'name';
        v_ni_number := v_delegate->>'national_insurance';
        v_dob := v_delegate->>'date_of_birth';
        v_address := v_delegate->>'address';
        v_postcode := v_delegate->>'postcode';
        
        -- Skip if name is empty
        IF v_delegate_name IS NULL OR trim(v_delegate_name) = '' THEN
          CONTINUE;
        END IF;
        
        v_delegate_name := trim(v_delegate_name);
        
        -- Parse name into first and last name
        v_name_parts := string_to_array(v_delegate_name, ' ');
        
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;
        
        -- Check if candidate already exists by name
        SELECT id INTO v_candidate_id 
        FROM candidates 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;
        
        -- Create candidate if doesn't exist (NOTE: No email/phone here, as delegates don't provide their own)
        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            national_insurance_number,
            date_of_birth,
            address,
            postcode,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_ni_number,
            CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE NULL END,
            v_address,
            v_postcode,
            'active',
            v_admin_user_id
          )
          RETURNING id INTO v_candidate_id;
          
          RAISE NOTICE 'Created candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        ELSE
          -- Update existing candidate with new information if provided
          UPDATE candidates
          SET 
            national_insurance_number = COALESCE(v_ni_number, national_insurance_number),
            date_of_birth = CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE date_of_birth END,
            address = COALESCE(v_address, address),
            postcode = COALESCE(v_postcode, postcode),
            updated_at = now()
          WHERE id = v_candidate_id;
          
          RAISE NOTICE 'Updated candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        END IF;
        
        -- Link candidate to course run if found
        IF v_candidate_id IS NOT NULL AND v_course_run_id IS NOT NULL THEN
          -- Check if enrollment already exists for this course run
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses 
            WHERE candidate_id = v_candidate_id 
              AND course_run_id = v_course_run_id
          ) THEN
            INSERT INTO candidate_courses (
              candidate_id,
              course_id,
              course_run_id,
              enrollment_date,
              status,
              created_by
            ) VALUES (
              v_candidate_id,
              v_course_id,
              v_course_run_id,
              CURRENT_DATE,
              'enrolled',
              v_admin_user_id
            );
            
            RAISE NOTICE 'Enrolled candidate % in course run %', v_candidate_id, v_course_run_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Migration: 20251204095805_20251104160000_add_candidate_to_bookings_and_auto_enroll.sql.sql
-- ============================================

/*
  # Add Candidate Reference to Bookings and Auto-Enrollment

  1. Changes
    - Add `candidate_id` column to `bookings` table to track which candidate a booking is for
    - Create trigger to automatically enroll candidates in courses when a booking is created
    - This ensures that individual bookings (from candidates) automatically appear in the candidate's enrolled courses

  2. Security
    - Maintains existing RLS policies
    - Adds foreign key constraint with CASCADE delete
*/

-- Add candidate_id column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'candidate_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_bookings_candidate_id ON bookings(candidate_id);
  END IF;
END $$;

-- Create function to auto-enroll candidate when booking is created
CREATE OR REPLACE FUNCTION auto_enroll_candidate_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Only process if there's a candidate_id
  IF NEW.candidate_id IS NOT NULL THEN
    -- Get the course_id from the course_run
    SELECT course_id INTO v_course_id
    FROM course_runs
    WHERE id = NEW.course_run_id;

    IF v_course_id IS NOT NULL THEN
      -- Check if candidate is already enrolled in this course run
      IF NOT EXISTS (
        SELECT 1 FROM candidate_courses
        WHERE candidate_id = NEW.candidate_id
        AND course_id = v_course_id
        AND course_run_id = NEW.course_run_id
      ) THEN
        -- Enroll the candidate
        INSERT INTO candidate_courses (
          candidate_id,
          course_id,
          course_run_id,
          enrollment_date,
          status
        ) VALUES (
          NEW.candidate_id,
          v_course_id,
          NEW.course_run_id,
          NOW(),
          'enrolled'
        );

        RAISE NOTICE 'Auto-enrolled candidate % in course % (run: %)', NEW.candidate_id, v_course_id, NEW.course_run_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_enroll_candidate_from_booking ON bookings;
CREATE TRIGGER trigger_auto_enroll_candidate_from_booking
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_candidate_from_booking();


-- ============================================
-- Migration: 20251204095810_20251104170000_link_existing_bookings_to_candidates.sql.sql
-- ============================================

/*
  # Link Existing Bookings to Candidates

  1. Purpose
    - Find existing bookings that match candidates by email, phone, or name
    - Update those bookings with the correct candidate_id
    - The existing trigger will then auto-enroll those candidates in their courses

  2. Matching Logic
    - First tries to match by email (most reliable)
    - Then tries to match by phone
    - Finally tries to match by first name + last name combination
    - Only matches where company_id is NULL (individual bookings)

  3. Process
    - Updates bookings table with candidate_id where matches found
    - The auto_enroll_candidate_from_booking trigger will NOT fire on UPDATE
    - So we manually create the enrollments for matched bookings
*/

-- First, let's link bookings to candidates based on matching contact information
DO $$
DECLARE
  v_booking RECORD;
  v_candidate_id uuid;
  v_contact RECORD;
  v_course_id uuid;
  v_enrolled_count integer := 0;
BEGIN
  -- Loop through all bookings that don't have a candidate_id and have no company (individual bookings)
  FOR v_booking IN
    SELECT b.id, b.contact_id, b.course_run_id
    FROM bookings b
    WHERE b.candidate_id IS NULL
    AND b.company_id IS NULL
  LOOP
    -- Get contact info
    SELECT * INTO v_contact
    FROM contacts
    WHERE id = v_booking.contact_id;

    IF v_contact IS NOT NULL THEN
      v_candidate_id := NULL;

      -- Try to match by email (most reliable)
      IF v_contact.email IS NOT NULL AND v_contact.email != '' THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE LOWER(email) = LOWER(v_contact.email)
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If no match by email, try by phone
      IF v_candidate_id IS NULL AND v_contact.phone IS NOT NULL AND v_contact.phone != '' THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE phone = v_contact.phone
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If no match by phone, try by name combination
      IF v_candidate_id IS NULL AND v_contact.first_name IS NOT NULL AND v_contact.last_name IS NOT NULL THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE LOWER(first_name) = LOWER(v_contact.first_name)
        AND LOWER(last_name) = LOWER(v_contact.last_name)
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If we found a matching candidate, update the booking and enroll them
      IF v_candidate_id IS NOT NULL THEN
        -- Update the booking with candidate_id
        UPDATE bookings
        SET candidate_id = v_candidate_id
        WHERE id = v_booking.id;

        -- Get the course_id from course_run
        SELECT course_id INTO v_course_id
        FROM course_runs
        WHERE id = v_booking.course_run_id;

        -- Enroll the candidate if not already enrolled
        IF v_course_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses
            WHERE candidate_id = v_candidate_id
            AND course_id = v_course_id
            AND course_run_id = v_booking.course_run_id
          ) THEN
            INSERT INTO candidate_courses (
              candidate_id,
              course_id,
              course_run_id,
              enrollment_date,
              status
            ) VALUES (
              v_candidate_id,
              v_course_id,
              v_booking.course_run_id,
              NOW(),
              'enrolled'
            );

            v_enrolled_count := v_enrolled_count + 1;
            RAISE NOTICE 'Linked and enrolled candidate % in course % (booking: %)', v_candidate_id, v_course_id, v_booking.id;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete: Linked and enrolled % candidates from existing bookings', v_enrolled_count;
END $$;

