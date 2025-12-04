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
