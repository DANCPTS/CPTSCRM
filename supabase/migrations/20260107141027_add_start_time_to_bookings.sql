/*
  # Add Start Time to Bookings

  1. Changes
    - Adds `start_time` column to the `bookings` table
    - Stores the course start time (e.g., '08:00', '09:30')
    - Defaults to '08:00' (8:00 AM) for new bookings
    - Existing bookings will have NULL and display default of 8:00 AM

  2. Purpose
    - Allow each booking to have its own custom start time
    - Support half-hour increments for flexible scheduling
    - Display per-booking start times in joining instructions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN start_time time DEFAULT '08:00:00';
  END IF;
END $$;

COMMENT ON COLUMN bookings.start_time IS 'The start time for this booking (defaults to 08:00)';