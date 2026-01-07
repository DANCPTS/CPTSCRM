/*
  # Add City Column to Booking Form Delegates

  1. Changes
    - Add `city` column to `booking_form_delegates` table
    - Column is optional (nullable) text field for delegate's city

  2. Purpose
    - Allows capturing the city/town for each delegate on the booking form
    - Improves address data completeness
*/

ALTER TABLE booking_form_delegates
ADD COLUMN IF NOT EXISTS city text;