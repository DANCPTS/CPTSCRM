/*
  # Add missing columns to bookings table

  1. Modified Tables
    - `bookings`
      - `booking_reference` (text) - unique reference code for the booking
      - `net_amount` (numeric) - net amount before VAT
      - `vat_amount` (numeric) - VAT amount
      - `vat_exempt` (boolean) - whether booking is VAT exempt, default false
      - `payment_link` (text) - Stripe or other payment link
      - `start_time` (text) - course start time, default '08:00'

  2. Important Notes
    - All columns are nullable or have defaults to avoid breaking existing data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'booking_reference'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN net_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'vat_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN vat_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'vat_exempt'
  ) THEN
    ALTER TABLE bookings ADD COLUMN vat_exempt boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE bookings ADD COLUMN start_time text DEFAULT '08:00';
  END IF;
END $$;