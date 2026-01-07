/*
  # Add Card Numbers to Booking Form Delegates

  1. New Columns
    - `citb_hse_number` (text, nullable) - CITB HSE test pass number
    - `cpcs_card_number` (text, nullable) - CPCS card number
    - `npors_card_number` (text, nullable) - NPORS card number

  2. Notes
    - All fields are optional as not all delegates will have these card numbers
    - CITB HSE number is for delegates who completed the test in the last two years
*/

ALTER TABLE booking_form_delegates
ADD COLUMN IF NOT EXISTS citb_hse_number text,
ADD COLUMN IF NOT EXISTS cpcs_card_number text,
ADD COLUMN IF NOT EXISTS npors_card_number text;
