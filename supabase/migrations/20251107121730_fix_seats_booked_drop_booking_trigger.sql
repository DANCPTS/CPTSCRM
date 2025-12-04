/*
  # Fix seats_booked double counting - drop booking trigger
  
  1. Changes
    - Drop the on_booking_change trigger that increments seats on bookings
    - Drop the update_course_run_seats function
    - Recalculate all seats_booked based on actual enrolled candidates
    
  2. Why
    - The booking trigger is causing double-counting
    - candidate_courses is the single source of truth for enrollment
    - Only the candidate_courses trigger should update seats_booked
*/

-- Drop the booking-based trigger
DROP TRIGGER IF EXISTS on_booking_change ON bookings;
DROP FUNCTION IF EXISTS update_course_run_seats();

-- Recalculate seats_booked for all course runs based on actual enrolled candidates
UPDATE course_runs cr
SET seats_booked = (
  SELECT COUNT(*)
  FROM candidate_courses cc
  WHERE cc.course_run_id = cr.id
  AND cc.status = 'enrolled'
);
