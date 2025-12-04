/*
  # Update seats_booked when candidate_courses changes

  1. Changes
    - Create trigger function to update seats_booked in course_runs table when candidate_courses records are inserted/deleted
    - This ensures the calendar shows accurate enrollment counts

  2. Notes
    - When a candidate_courses record is inserted, increment seats_booked
    - When a candidate_courses record is deleted, decrement seats_booked
    - Only affects course_runs that have a matching course_run_id
*/

-- Function to update seats_booked count based on candidate_courses changes
CREATE OR REPLACE FUNCTION update_seats_booked_from_candidate_courses()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment seats_booked when a candidate enrolls
    IF NEW.course_run_id IS NOT NULL THEN
      UPDATE course_runs
      SET seats_booked = COALESCE(seats_booked, 0) + 1
      WHERE id = NEW.course_run_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement seats_booked when a candidate is removed
    IF OLD.course_run_id IS NOT NULL THEN
      UPDATE course_runs
      SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
      WHERE id = OLD.course_run_id;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle course_run_id changes
    IF OLD.course_run_id IS NOT NULL AND OLD.course_run_id != NEW.course_run_id THEN
      -- Decrement from old course run
      UPDATE course_runs
      SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
      WHERE id = OLD.course_run_id;
    END IF;
    
    IF NEW.course_run_id IS NOT NULL AND OLD.course_run_id != NEW.course_run_id THEN
      -- Increment on new course run
      UPDATE course_runs
      SET seats_booked = COALESCE(seats_booked, 0) + 1
      WHERE id = NEW.course_run_id;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on candidate_courses
DROP TRIGGER IF EXISTS update_seats_booked_candidate_courses_trigger ON candidate_courses;
CREATE TRIGGER update_seats_booked_candidate_courses_trigger
  AFTER INSERT OR UPDATE OR DELETE ON candidate_courses
  FOR EACH ROW
  EXECUTE FUNCTION update_seats_booked_from_candidate_courses();