/*
  # Update seats_booked to handle status changes

  1. Changes
    - Modify the trigger function to only count "enrolled" candidates
    - When a candidate's status changes from "enrolled" to another status (like "cancelled"), decrement seats_booked
    - When a candidate's status changes to "enrolled", increment seats_booked

  2. Notes
    - This ensures that only actively enrolled candidates are counted in seats_booked
    - Cancelled or withdrawn candidates will not be counted
*/

-- Updated function to handle status changes
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
    IF OLD.course_run_id IS NOT NULL AND OLD.course_run_id != NEW.course_run_id THEN
      -- Decrement from old course run only if old status was 'enrolled'
      IF OLD.status = 'enrolled' THEN
        UPDATE course_runs
        SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
        WHERE id = OLD.course_run_id;
      END IF;
    END IF;
    
    IF NEW.course_run_id IS NOT NULL AND OLD.course_run_id != NEW.course_run_id THEN
      -- Increment on new course run only if new status is 'enrolled'
      IF NEW.status = 'enrolled' THEN
        UPDATE course_runs
        SET seats_booked = COALESCE(seats_booked, 0) + 1
        WHERE id = NEW.course_run_id;
      END IF;
    END IF;
    
    -- Handle status changes within the same course run
    IF OLD.course_run_id = NEW.course_run_id THEN
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
