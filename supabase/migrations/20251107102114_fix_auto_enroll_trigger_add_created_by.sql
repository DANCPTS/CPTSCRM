/*
  # Fix Auto-Enroll Trigger to Include created_by

  1. Changes
    - Update the auto_enroll_candidate_from_booking function to include created_by field
    - This prevents null constraint violations when auto-enrolling candidates

  2. Security
    - Maintains existing RLS policies
*/

CREATE OR REPLACE FUNCTION auto_enroll_candidate_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id uuid;
  v_user_id uuid;
BEGIN
  -- Only process if there's a candidate_id
  IF NEW.candidate_id IS NOT NULL THEN
    -- Get the course_id from the course_run
    SELECT course_id INTO v_course_id
    FROM course_runs
    WHERE id = NEW.course_run_id;

    -- Try to get the current user, fallback to a system user if not available
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      -- Get the first user as a fallback (system user)
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;

    IF v_course_id IS NOT NULL AND v_user_id IS NOT NULL THEN
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
$$ LANGUAGE plpgsql;
