/*
  # Add booking_reference column to leads and booking_forms

  1. Modified Tables
    - `leads`
      - Added `booking_reference` (text, nullable) - stores a reference code for the booking
    - `booking_forms`
      - Added `booking_reference` (text, nullable) - stores a reference code for the booking form

  2. Notes
    - Both columns are optional text fields
    - No default value needed as these are manually entered references
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'booking_reference'
  ) THEN
    ALTER TABLE leads ADD COLUMN booking_reference text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'booking_reference'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN booking_reference text;
  END IF;
END $$;