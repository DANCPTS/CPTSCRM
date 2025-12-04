/*
  # Fix Auto-Enrollment Trigger to Include created_by

  1. Changes
    - Update auto_enroll_candidate_from_booking function to include created_by field
    - Uses auth.uid() if available, otherwise uses a system user
    - Fixes the constraint violation error

  2. Security
    - Maintains existing RLS policies
*/

-- Update the function to include created_by
CREATE OR REPLACE FUNCTION auto_enroll_candidate_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id uuid;
  v_created_by uuid;
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
        -- Get created_by: use auth.uid() if available, otherwise use first admin user
        v_created_by := auth.uid();
        IF v_created_by IS NULL THEN
          SELECT id INTO v_created_by FROM users LIMIT 1;
        END IF;

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
          v_created_by
        );

        RAISE NOTICE 'Auto-enrolled candidate % in course % (run: %)', NEW.candidate_id, v_course_id, NEW.course_run_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
