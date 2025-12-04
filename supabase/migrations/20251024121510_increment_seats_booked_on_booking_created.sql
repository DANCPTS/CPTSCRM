/*
  # Increment seats_booked when booking is created

  1. Changes
    - Create function to increment seats_booked in course_runs table when a booking is created
    - Create trigger on bookings table to call this function
    
  2. Behavior
    - When a booking is inserted, increment the seats_booked count for the associated course_run
    - When a booking is deleted, decrement the seats_booked count
    - When a booking's course_run_id is updated, adjust counts accordingly
    
  3. Security
    - Function uses SECURITY DEFINER to ensure it can update course_runs
*/

-- Function to update seats_booked count
CREATE OR REPLACE FUNCTION update_course_run_seats()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Increment seats_booked for the new booking
    UPDATE course_runs
    SET seats_booked = COALESCE(seats_booked, 0) + 1
    WHERE id = NEW.course_run_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    -- Decrement seats_booked for the deleted booking
    UPDATE course_runs
    SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
    WHERE id = OLD.course_run_id;
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If course_run_id changed, update both old and new runs
    IF OLD.course_run_id != NEW.course_run_id THEN
      -- Decrement old course run
      UPDATE course_runs
      SET seats_booked = GREATEST(COALESCE(seats_booked, 0) - 1, 0)
      WHERE id = OLD.course_run_id;
      
      -- Increment new course run
      UPDATE course_runs
      SET seats_booked = COALESCE(seats_booked, 0) + 1
      WHERE id = NEW.course_run_id;
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bookings
DROP TRIGGER IF EXISTS on_booking_change ON bookings;

CREATE TRIGGER on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_course_run_seats();
