/*
  # Cancel candidate enrollment when booking is cancelled

  1. Changes
    - Create trigger to automatically update candidate_courses status to 'cancelled' when a booking is cancelled
    - This ensures that cancelled bookings don't count towards seats_booked

  2. Security
    - Maintains existing RLS policies
*/

-- Function to cancel candidate enrollment when booking is cancelled
CREATE OR REPLACE FUNCTION cancel_candidate_enrollment_on_booking_cancel()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if booking status changed to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Update the candidate_courses status to 'cancelled' if candidate_id is set
    IF NEW.candidate_id IS NOT NULL AND NEW.course_run_id IS NOT NULL THEN
      UPDATE candidate_courses
      SET status = 'cancelled'
      WHERE candidate_id = NEW.candidate_id
      AND course_run_id = NEW.course_run_id
      AND status = 'enrolled';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS cancel_candidate_enrollment_trigger ON bookings;
CREATE TRIGGER cancel_candidate_enrollment_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION cancel_candidate_enrollment_on_booking_cancel();
