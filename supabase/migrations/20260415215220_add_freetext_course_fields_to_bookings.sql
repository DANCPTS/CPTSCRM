/*
  # Add free-text course fields to bookings

  1. Modified Tables
    - `bookings`
      - `course_name` (text, nullable) - Free-text course name entered at booking time
      - `course_dates` (text, nullable) - Free-text date description (e.g. "15-17 Jan 2025")
      - `course_venue` (text, nullable) - Free-text venue/location
  
  2. Changes
    - Make `course_run_id` nullable so bookings can exist without a formal course run
    - Existing bookings with course_run_id remain intact
    - New bookings will use free-text fields instead

  3. Important Notes
    - No data is deleted or modified
    - Legacy bookings continue to work via course_run_id joins
    - New bookings populate the free-text fields directly
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'course_name'
  ) THEN
    ALTER TABLE bookings ADD COLUMN course_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'course_dates'
  ) THEN
    ALTER TABLE bookings ADD COLUMN course_dates text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'course_venue'
  ) THEN
    ALTER TABLE bookings ADD COLUMN course_venue text;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings'
      AND column_name = 'course_run_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN course_run_id DROP NOT NULL;
  END IF;
END $$;