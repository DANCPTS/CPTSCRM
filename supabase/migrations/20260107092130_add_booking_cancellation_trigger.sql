/*
  # Add Booking Cancellation Trigger
  
  1. Changes
    - Creates a trigger to automatically update candidate_courses status to 'cancelled' when a booking is cancelled
    - This ensures that cancelled candidates still appear in the calendar but are marked as cancelled
    - The seats_booked count will automatically update to exclude cancelled enrollments
  
  2. Functionality
    - When a booking status changes to 'cancelled', the corresponding candidate_courses record is updated to 'cancelled'
    - This allows cancelled candidates to remain visible in the calendar with a crossed-out appearance
    - The trigger only affects candidate_courses records with status 'enrolled'
  
  3. Security
    - Maintains existing RLS policies
    - Uses SECURITY DEFINER to ensure trigger has necessary permissions
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
      
      RAISE NOTICE 'Cancelled enrollment for candidate % in course run %', NEW.candidate_id, NEW.course_run_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS cancel_candidate_enrollment_trigger ON bookings;
CREATE TRIGGER cancel_candidate_enrollment_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION cancel_candidate_enrollment_on_booking_cancel();
