/*
  # Create Auto-Enroll Trigger for Bookings

  1. New Functions
    - `auto_enroll_candidate_from_booking()` - Automatically enrolls candidates when a booking is created
  
  2. New Triggers
    - Trigger on bookings table that calls the auto-enroll function
  
  3. Changes
    - When a booking is created or updated with a candidate_id, automatically create a candidate_courses entry
    - This ensures candidates appear on the calendar immediately when booked
  
  4. Backfill
    - Enrolls any existing bookings that have a candidate_id but no candidate_courses entry
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS auto_enroll_on_booking_insert ON bookings;
DROP TRIGGER IF EXISTS auto_enroll_on_booking_update ON bookings;
DROP FUNCTION IF EXISTS auto_enroll_candidate_from_booking();

-- Create the auto-enroll function
CREATE OR REPLACE FUNCTION auto_enroll_candidate_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id uuid;
  v_user_id uuid;
BEGIN
  -- Only process if there's a candidate_id and status is confirmed
  IF NEW.candidate_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    -- Get the course_id from the course_run
    SELECT course_id INTO v_course_id
    FROM course_runs
    WHERE id = NEW.course_run_id;

    -- Try to get the current user, fallback to the booking's created_by if available
    v_user_id := auth.uid();
    
    -- If no auth user, try to use a system default
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
    END IF;

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
          status,
          created_by
        ) VALUES (
          NEW.candidate_id,
          v_course_id,
          NEW.course_run_id,
          NOW(),
          'enrolled',
          v_user_id
        );

        RAISE NOTICE 'Auto-enrolled candidate % in course % (run: %)', NEW.candidate_id, v_course_id, NEW.course_run_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT
CREATE TRIGGER auto_enroll_on_booking_insert
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_enroll_candidate_from_booking();

-- Create trigger for UPDATE
CREATE TRIGGER auto_enroll_on_booking_update
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.candidate_id IS DISTINCT FROM OLD.candidate_id OR NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION auto_enroll_candidate_from_booking();

-- Backfill: Enroll existing bookings that have candidates but no enrollment
DO $$
DECLARE
  v_booking RECORD;
  v_course_id uuid;
  v_user_id uuid;
BEGIN
  -- Get first user as system user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    FOR v_booking IN 
      SELECT DISTINCT b.id, b.candidate_id, b.course_run_id
      FROM bookings b
      WHERE b.candidate_id IS NOT NULL 
        AND b.status = 'confirmed'
        AND NOT EXISTS (
          SELECT 1 FROM candidate_courses cc
          WHERE cc.candidate_id = b.candidate_id
          AND cc.course_run_id = b.course_run_id
        )
    LOOP
      -- Get course_id for this booking
      SELECT course_id INTO v_course_id
      FROM course_runs
      WHERE id = v_booking.course_run_id;
      
      IF v_course_id IS NOT NULL THEN
        -- Create the enrollment
        INSERT INTO candidate_courses (
          candidate_id,
          course_id,
          course_run_id,
          enrollment_date,
          status,
          created_by
        ) VALUES (
          v_booking.candidate_id,
          v_course_id,
          v_booking.course_run_id,
          NOW(),
          'enrolled',
          v_user_id
        );
        
        RAISE NOTICE 'Backfilled enrollment for booking %', v_booking.id;
      END IF;
    END LOOP;
  END IF;
END $$;
