/*
  # Fix Booking Cancellation to Handle All Candidates
  
  1. Changes
    - Updates the booking cancellation trigger to handle candidates linked both directly and via course_run_id
    - When a booking is cancelled, all enrolled candidates for that course run and invoice are marked as cancelled
    - This frees up seats while keeping candidates visible on the calendar as "cancelled"
  
  2. How It Works
    - If booking has candidate_id: cancel that specific candidate's enrollment
    - If booking has invoice_no: cancel all candidates enrolled for that course run with matching invoice
    - Seats are automatically freed by the existing seats_booked trigger (only counts 'enrolled' status)
  
  3. Result
    - Cancelled candidates still appear on calendar but marked as cancelled
    - Seats are freed up for new bookings
    - Multiple candidates from same invoice are all cancelled together
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS cancel_candidate_enrollment_trigger ON bookings;
DROP FUNCTION IF EXISTS cancel_candidate_enrollment_on_booking_cancel();

-- Recreate function with improved logic
CREATE OR REPLACE FUNCTION cancel_candidate_enrollment_on_booking_cancel()
RETURNS TRIGGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Check if booking status changed to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    
    -- Case 1: Booking has a direct candidate_id link
    IF NEW.candidate_id IS NOT NULL AND NEW.course_run_id IS NOT NULL THEN
      UPDATE candidate_courses
      SET status = 'cancelled'
      WHERE candidate_id = NEW.candidate_id
      AND course_run_id = NEW.course_run_id
      AND status = 'enrolled';
      
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      RAISE NOTICE 'Cancelled % enrollment(s) for candidate % in course run %', updated_count, NEW.candidate_id, NEW.course_run_id;
    END IF;
    
    -- Case 2: Find candidates enrolled for this course run via the same invoice
    -- This handles cases where candidates are linked through bookings with the same invoice_no
    IF NEW.invoice_no IS NOT NULL AND NEW.course_run_id IS NOT NULL THEN
      -- Get all candidate IDs from bookings with this invoice for this course run
      UPDATE candidate_courses cc
      SET status = 'cancelled'
      FROM bookings b
      WHERE cc.candidate_id IN (
        SELECT DISTINCT candidate_id 
        FROM bookings 
        WHERE invoice_no = NEW.invoice_no 
        AND course_run_id = NEW.course_run_id
        AND candidate_id IS NOT NULL
      )
      AND cc.course_run_id = NEW.course_run_id
      AND cc.status = 'enrolled';
      
      GET DIAGNOSTICS updated_count = ROW_COUNT;
      IF updated_count > 0 THEN
        RAISE NOTICE 'Cancelled % enrollment(s) for invoice % in course run %', updated_count, NEW.invoice_no, NEW.course_run_id;
      END IF;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER cancel_candidate_enrollment_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION cancel_candidate_enrollment_on_booking_cancel();
