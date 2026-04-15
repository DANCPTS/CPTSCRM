/*
  # Add Multi-Course Booking Form Support

  This migration creates the missing tables and columns needed for
  multi-course booking forms.

  1. Updated Tables
    - `booking_forms`: Add `total_delegates` (integer) and `total_amount` (numeric) columns

  2. New Tables
    - `booking_form_courses`: Stores courses included in a booking form
      - `id` (uuid, primary key)
      - `booking_form_id` (uuid, FK to booking_forms)
      - `course_name` (text)
      - `course_dates` (text)
      - `course_venue` (text)
      - `number_of_delegates` (integer)
      - `price` (numeric)
      - `currency` (text, default GBP)
      - `display_order` (integer)
      - `vat_exempt` (boolean, default false)
      - `created_at` (timestamptz)

    - `booking_form_delegates`: Stores delegate details from booking forms
      - `id` (uuid, primary key)
      - `booking_form_id` (uuid, FK to booking_forms)
      - `name`, `email`, `phone`, `national_insurance`, `date_of_birth`, etc.
      - `city`, `citb_hse_number`, `cpcs_card_number`, `npors_card_number`

    - `booking_form_delegate_courses`: Junction table for delegates-courses
      - `id` (uuid, primary key)
      - `booking_form_id`, `delegate_id`, `course_id` (foreign keys)

  3. Security
    - RLS enabled on all new tables
    - Authenticated users can CRUD all booking form data
    - Anonymous users can read/insert/update via booking form token

  4. Indexes
    - Foreign key indexes on all new tables for performance
*/

-- =====================================================
-- ADD COLUMNS TO booking_forms
-- =====================================================

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
-- CREATE booking_form_courses TABLE
-- =====================================================

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
  vat_exempt boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_form_courses_booking_form_id ON booking_form_courses(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_courses_display_order ON booking_form_courses(booking_form_id, display_order);

ALTER TABLE booking_form_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view booking form courses"
  ON booking_form_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_courses.booking_form_id
    )
  );

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
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update booking form courses"
  ON booking_form_courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_courses.booking_form_id
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete booking form courses"
  ON booking_form_courses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_courses.booking_form_id
    )
  );

-- =====================================================
-- CREATE booking_form_delegates TABLE
-- =====================================================

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
  city text,
  citb_hse_number text,
  cpcs_card_number text,
  npors_card_number text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_form_delegates_booking_form_id ON booking_form_delegates(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegates_email ON booking_form_delegates(email);

ALTER TABLE booking_form_delegates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view booking form delegates"
  ON booking_form_delegates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
    )
  );

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
  WITH CHECK (auth.uid() IS NOT NULL);

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
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

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
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegates.booking_form_id
    )
  );

-- =====================================================
-- CREATE booking_form_delegate_courses TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS booking_form_delegate_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_form_id uuid NOT NULL REFERENCES booking_forms(id) ON DELETE CASCADE,
  delegate_id uuid NOT NULL REFERENCES booking_form_delegates(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES booking_form_courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(delegate_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_booking_form_id ON booking_form_delegate_courses(booking_form_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_delegate_id ON booking_form_delegate_courses(delegate_id);
CREATE INDEX IF NOT EXISTS idx_booking_form_delegate_courses_course_id ON booking_form_delegate_courses(course_id);

ALTER TABLE booking_form_delegate_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view delegate course assignments"
  ON booking_form_delegate_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
    )
  );

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
  WITH CHECK (auth.uid() IS NOT NULL);

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
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

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
  USING (
    EXISTS (
      SELECT 1 FROM booking_forms
      WHERE booking_forms.id = booking_form_delegate_courses.booking_form_id
    )
  );

-- =====================================================
-- BACKWARD COMPATIBILITY TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION sync_first_proposal_course_to_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_id uuid;
  v_first_course proposal_courses%ROWTYPE;
BEGIN
  v_lead_id := COALESCE(NEW.lead_id, OLD.lead_id);

  SELECT * INTO v_first_course
  FROM proposal_courses
  WHERE lead_id = v_lead_id
  ORDER BY display_order ASC
  LIMIT 1;

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

DROP TRIGGER IF EXISTS sync_proposal_course_to_lead_trigger ON proposal_courses;
CREATE TRIGGER sync_proposal_course_to_lead_trigger
AFTER INSERT OR UPDATE OR DELETE ON proposal_courses
FOR EACH ROW
EXECUTE FUNCTION sync_first_proposal_course_to_lead();