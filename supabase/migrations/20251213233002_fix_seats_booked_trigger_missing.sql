/*
  # Fix Missing Seats Booked Trigger
  
  1. Issue
    - The seats_booked trigger is missing from the candidate_courses table
    - Candidates are being enrolled but the counter is not updating
  
  2. Changes
    - Recreate the trigger function `update_seats_booked_from_candidate_courses()`
    - Recreate the trigger `update_seats_booked_candidate_courses_trigger`
    - Recalculate all seats_booked values based on actual enrolled candidates
  
  3. How It Works
    - When a candidate_courses record is inserted with status='enrolled', increment seats_booked
    - When a candidate_courses record is deleted with status='enrolled', decrement seats_booked
    - When status changes to/from 'enrolled', update seats_booked accordingly
    - When course_run_id changes, update both old and new course runs
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS update_seats_booked_candidate_courses_trigger ON candidate_courses;
DROP FUNCTION IF EXISTS update_seats_booked_from_candidate_courses();

-- Create the trigger function
CREATE OR REPLACE FUNCTION update_seats_booked_from_candidate_courses()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only increment if status is 'enrolled'
    IF NEW.course_run_id IS NOT NULL AND NEW.status = 'enrolled' THEN
      UPDATE course_runs
      SET seats_booked = COALESCE(seats_booked, 0) + 1
      WHERE id = NEW.course_run_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if the deleted record was 'enrolled'
    IF OLD.course_run_id IS NOT NULL AND OLD.status = 'enrolled' THEN
      UPDATE course_runs
      SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
      WHERE id = OLD.course_run_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle course_run_id changes
    IF OLD.course_run_id IS NOT NULL AND OLD.course_run_id != COALESCE(NEW.course_run_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      -- Decrement from old course run only if old status was 'enrolled'
      IF OLD.status = 'enrolled' THEN
        UPDATE course_runs
        SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
        WHERE id = OLD.course_run_id;
      END IF;
    END IF;
    
    IF NEW.course_run_id IS NOT NULL AND COALESCE(OLD.course_run_id, '00000000-0000-0000-0000-000000000000'::uuid) != NEW.course_run_id THEN
      -- Increment on new course run only if new status is 'enrolled'
      IF NEW.status = 'enrolled' THEN
        UPDATE course_runs
        SET seats_booked = COALESCE(seats_booked, 0) + 1
        WHERE id = NEW.course_run_id;
      END IF;
    END IF;
    
    -- Handle status changes within the same course run
    IF COALESCE(OLD.course_run_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(NEW.course_run_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      IF OLD.status = 'enrolled' AND NEW.status != 'enrolled' THEN
        -- Decrement when changing from enrolled to another status
        UPDATE course_runs
        SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
        WHERE id = NEW.course_run_id;
      ELSIF OLD.status != 'enrolled' AND NEW.status = 'enrolled' THEN
        -- Increment when changing to enrolled from another status
        UPDATE course_runs
        SET seats_booked = COALESCE(seats_booked, 0) + 1
        WHERE id = NEW.course_run_id;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER update_seats_booked_candidate_courses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON candidate_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_seats_booked_from_candidate_courses();

-- Recalculate all seats_booked values based on actual enrolled candidates
UPDATE course_runs cr
SET seats_booked = (
  SELECT COUNT(*)
  FROM candidate_courses cc
  WHERE cc.course_run_id = cr.id
  AND cc.status = 'enrolled'
);
