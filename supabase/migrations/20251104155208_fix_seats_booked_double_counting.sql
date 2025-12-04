/*
  # Fix seats_booked double counting issue

  1. Changes
    - Drop the booking-based seats_booked trigger (obsolete now that we have candidate_courses trigger)
    - Recalculate seats_booked based on actual candidate_courses count
    
  2. Why
    - Currently both bookings AND candidate_courses triggers update seats_booked
    - This causes double-counting when a booking creates a candidate_course
    - candidate_courses is the source of truth for enrollment
*/

-- Drop the old booking-based trigger
DROP TRIGGER IF EXISTS update_seats_booked_trigger ON bookings;
DROP FUNCTION IF EXISTS update_seats_booked();

-- Recalculate seats_booked for all course runs based on actual enrolled candidates
UPDATE course_runs cr
SET seats_booked = (
  SELECT COUNT(*)
  FROM candidate_courses cc
  WHERE cc.course_run_id = cr.id
  AND cc.status = 'enrolled'
);
