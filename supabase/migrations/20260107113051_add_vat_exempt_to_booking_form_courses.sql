/*
  # Add VAT Exempt Support to Booking Form Courses

  1. Changes to booking_form_courses Table
    - `vat_exempt` (boolean, default false) - Whether this course is VAT-exempt (Dubai account)

  2. Changes to proposal_courses Table
    - `vat_exempt` (boolean, default false) - Whether this course is VAT-exempt

  3. Notes
    - VAT-exempt setting flows from proposal -> booking form -> booking
    - Used for Dubai account customers who don't pay UK VAT
*/

-- Add vat_exempt column to booking_form_courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_form_courses' AND column_name = 'vat_exempt'
  ) THEN
    ALTER TABLE booking_form_courses ADD COLUMN vat_exempt boolean DEFAULT false;
  END IF;
END $$;

-- Add vat_exempt column to proposal_courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'proposal_courses' AND column_name = 'vat_exempt'
  ) THEN
    ALTER TABLE proposal_courses ADD COLUMN vat_exempt boolean DEFAULT false;
  END IF;
END $$;
