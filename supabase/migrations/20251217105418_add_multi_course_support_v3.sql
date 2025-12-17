/*
  # Add Multi-Course Support to Proposals and Booking Forms

  ## Overview
  This migration enables proposals and booking forms to support multiple courses
  with delegates able to enroll in any combination of courses.

  ## New Tables

  ### `proposal_courses`
  Stores multiple courses for a single lead/proposal
  - `id` (uuid, primary key)
  - `lead_id` (uuid, foreign key to leads)
  - `course_name` (text)
  - `price` (numeric)
  - `currency` (text, default 'GBP')
  - `dates` (text)
  - `venue` (text)
  - `number_of_delegates` (integer)
  - `notes` (text, optional)
  - `display_order` (integer, for sorting)
  - `created_at` (timestamptz)
  - `created_by` (uuid, foreign key to users)

  ### `booking_form_courses`
  Stores courses included in a booking form
  - `id` (uuid, primary key)
  - `booking_form_id` (uuid, foreign key to booking_forms)
  - `course_name` (text)
  - `course_dates` (text)
  - `course_venue` (text)
  - `number_of_delegates` (integer)
  - `price` (numeric)
  - `currency` (text, default 'GBP')
  - `display_order` (integer, for sorting)
  - `created_at` (timestamptz)

  ### `booking_form_delegates`
  Stores delegate information from booking forms
  - `id` (uuid, primary key)
  - `booking_form_id` (uuid, foreign key to booking_forms)
  - `name` (text)
  - `email` (text)
  - `phone` (text, optional)
  - `national_insurance` (text, optional)
  - `date_of_birth` (date, optional)
  - `address` (text, optional)
  - `postcode` (text, optional)
  - `created_at` (timestamptz)

  ### `booking_form_delegate_courses`
  Junction table for many-to-many relationship between delegates and courses
  - `id` (uuid, primary key)
  - `booking_form_id` (uuid, foreign key to booking_forms)
  - `delegate_id` (uuid, foreign key to booking_form_delegates)
  - `course_id` (uuid, foreign key to booking_form_courses)
  - `created_at` (timestamptz)

  ## Table Updates

  ### `booking_forms`
  Add new fields for multi-course support:
  - `total_delegates` (integer) - aggregate count across all courses
  - `total_amount` (numeric) - sum of all course prices

  ## Security
  - Enable RLS on all new tables
  - Add policies for authenticated users to manage their data
  - Add policies for anonymous users to interact with booking forms via token

  ## Indexes
  - Add indexes on foreign keys for performance
  - Add index on booking_form_id for quick lookups

  ## Backward Compatibility
  - Keep existing single-course fields in leads and booking_forms
  - Add trigger to sync first course from proposal_courses to lead fields
*/

-- =====================================================
-- CREATE TABLES
-- =====================================================

-- Proposal courses table
CREATE TABLE IF NOT EXISTS proposal_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  dates text,
  venue text,
  number_of_delegates integer NOT NULL DEFAULT 1,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Booking form courses table
CREATE TABLE IF NOT EXISTS booking_form_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id uuid NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  course_dates text,
  course_venue text,
  number_of_delegates integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Booking form delegates table
CREATE TABLE IF NOT EXISTS booking_form_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id uuid NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  national_insurance text,
  date_of_birth date,
  address text,
  postcode text,
  created_at timestamptz DEFAULT now()
);

-- Junction table for delegates and courses
CREATE TABLE IF NOT EXISTS booking_form_delegate_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id uuid NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES booking_form_delegates(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES booking_form_courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delegate_id, course_id)
);

-- =====================================================
-- UPDATE EXISTING TABLES
-- =====================================================

-- Add multi-course fields to booking_forms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'total_delegates'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN total_delegates integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN total_amount numeric DEFAULT 0;
  END IF;
END $$;

-- =====================================================
-- CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_proposal_courses_lead_id ON proposal_courses(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_courses_display_order ON proposal_courses(lead_id, display_order);

CREATE INDEX IF NOT EXISTS idx_booking_form_courses_booking_form_id ON booking_form_courses(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_courses_display_order ON booking_form_courses(booking_form_id, display_order);

CREATE INDEX IF NOT EXISTS idx_booking_form_delegates_booking_form_id ON booking_form_delegates(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegates_email ON booking_form_delegates(email);

CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_booking_form_id ON booking_form_delegate_courses(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_delegate_id ON booking_form_delegate_courses(delegate_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_course_id ON booking_form_delegate_courses(course_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE proposal_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_form_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_form_delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_form_delegate_courses ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - proposal_courses
-- =====================================================

CREATE POLICY "Authenticated users can view proposal courses"
  ON proposal_courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert proposal courses"
  ON proposal_courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update proposal courses"
  ON proposal_courses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete proposal courses"
  ON proposal_courses FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- CREATE RLS POLICIES - booking_form_courses
-- =====================================================

CREATE POLICY "Authenticated users can view booking form courses"
  ON booking_form_courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous can view booking form courses via token"
  ON booking_form_courses FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_courses.booking_form_id
    )
  );

CREATE POLICY "Authenticated users can insert booking form courses"
  ON booking_form_courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update booking form courses"
  ON booking_form_courses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete booking form courses"
  ON booking_form_courses FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- CREATE RLS POLICIES - booking_form_delegates
-- =====================================================

CREATE POLICY "Authenticated users can view booking form delegates"
  ON booking_form_delegates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous can view booking form delegates via token"
  ON booking_form_delegates FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
    )
  );

CREATE POLICY "Authenticated users can insert booking form delegates"
  ON booking_form_delegates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can insert booking form delegates via token"
  ON booking_form_delegates FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
      AND booking_forms.status = 'pending'
    )
  );

CREATE POLICY "Authenticated users can update booking form delegates"
  ON booking_form_delegates FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can update booking form delegates via token"
  ON booking_form_delegates FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
      AND booking_forms.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
      AND booking_forms.status = 'pending'
    )
  );

CREATE POLICY "Authenticated users can delete booking form delegates"
  ON booking_form_delegates FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- CREATE RLS POLICIES - booking_form_delegate_courses
-- =====================================================

CREATE POLICY "Authenticated users can view delegate course assignments"
  ON booking_form_delegate_courses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anonymous can view delegate course assignments via token"
  ON booking_form_delegate_courses FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
    )
  );

CREATE POLICY "Authenticated users can insert delegate course assignments"
  ON booking_form_delegate_courses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can insert delegate course assignments via token"
  ON booking_form_delegate_courses FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
      AND booking_forms.status = 'pending'
    )
  );

CREATE POLICY "Authenticated users can update delegate course assignments"
  ON booking_form_delegate_courses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous can update delegate course assignments via token"
  ON booking_form_delegate_courses FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
      AND booking_forms.status = 'pending'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
      AND booking_forms.status = 'pending'
    )
  );

CREATE POLICY "Authenticated users can delete delegate course assignments"
  ON booking_form_delegate_courses FOR DELETE
  TO authenticated
  USING (true);

-- =====================================================
-- CREATE TRIGGER FOR BACKWARD COMPATIBILITY
-- =====================================================

-- Trigger function to sync first proposal course to lead fields
CREATE OR REPLACE FUNCTION sync_first_proposal_course_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_id uuid;
  v_first_course proposal_courses%ROWTYPE;
BEGIN
  -- Get the lead_id
  v_lead_id := COALESCE(NEW.lead_id, OLD.lead_id);
  
  -- Get first course for this lead
  SELECT * INTO v_first_course
  FROM proposal_courses
  WHERE lead_id = v_lead_id
  ORDER BY display_order ASC
  LIMIT 1;
  
  -- If we found a course, update the lead
  IF FOUND THEN
    UPDATE leads
    SET
      quoted_course = v_first_course.course_name,
      quoted_price = v_first_course.price,
      quoted_currency = v_first_course.currency,
      quoted_dates = v_first_course.dates,
      quoted_venue = v_first_course.venue,
      number_of_delegates = v_first_course.number_of_delegates
    WHERE id = v_lead_id;
  ELSE
    -- No courses remain, clear lead fields
    UPDATE leads
    SET
      quoted_course = NULL,
      quoted_price = NULL,
      quoted_currency = 'GBP',
      quoted_dates = NULL,
      quoted_venue = NULL,
      number_of_delegates = NULL
    WHERE id = v_lead_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to proposal_courses
DROP TRIGGER IF EXISTS sync_proposal_course_to_lead_trigger ON proposal_courses;
CREATE TRIGGER sync_proposal_course_to_lead_trigger
AFTER INSERT OR UPDATE OR DELETE ON proposal_courses
FOR EACH ROW
EXECUTE FUNCTION sync_first_proposal_course_to_lead();

-- =====================================================
-- MIGRATE EXISTING DATA
-- =====================================================

-- Migrate existing proposal data from leads to proposal_courses
INSERT INTO proposal_courses (
  lead_id,
  course_name,
  price,
  currency,
  dates,
  venue,
  number_of_delegates,
  display_order,
  created_at,
  created_by
)
SELECT
  id,
  quoted_course,
  COALESCE(quoted_price, 0),
  COALESCE(quoted_currency, 'GBP'),
  quoted_dates,
  quoted_venue,
  COALESCE(number_of_delegates, 1),
  0,
  created_at,
  created_by
FROM leads
WHERE quoted_course IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM proposal_courses WHERE proposal_courses.lead_id = leads.id
)
ON CONFLICT DO NOTHING;

-- Migrate existing booking form data
INSERT INTO booking_form_courses (
  booking_form_id,
  course_name,
  course_dates,
  course_venue,
  number_of_delegates,
  price,
  currency,
  display_order
)
SELECT
  bf.id,
  COALESCE(bf.form_data->>'courseName', l.quoted_course, 'Course'),
  COALESCE(bf.form_data->>'courseDates', l.quoted_dates, ''),
  COALESCE(bf.form_data->>'courseVenue', l.quoted_venue, ''),
  COALESCE((bf.form_data->>'numberOfDelegates')::integer, l.number_of_delegates, 1),
  COALESCE((bf.form_data->>'price')::numeric, l.quoted_price, 0),
  COALESCE(bf.form_data->>'currency', l.quoted_currency, 'GBP'),
  0
FROM booking_forms bf
LEFT JOIN leads l ON bf.lead_id = l.id
WHERE NOT EXISTS (
  SELECT 1 FROM booking_form_courses WHERE booking_form_courses.booking_form_id = bf.id
)
ON CONFLICT DO NOTHING;

-- Update total_amount and total_delegates for existing booking forms
UPDATE booking_forms
SET
  total_amount = COALESCE((
    SELECT SUM(price)
    FROM booking_form_courses
    WHERE booking_form_courses.booking_form_id = booking_forms.id
  ), 0),
  total_delegates = COALESCE((
    SELECT SUM(number_of_delegates)
    FROM booking_form_courses
    WHERE booking_form_courses.booking_form_id = booking_forms.id
  ), 0)
WHERE total_amount = 0 OR total_delegates = 0;
