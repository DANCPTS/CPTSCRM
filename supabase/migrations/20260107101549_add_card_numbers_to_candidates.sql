/*
  # Add Card Numbers to Candidates Table

  1. New Columns
    - `citb_hse_number` (text, nullable) - CITB HSE test pass number
    - `cpcs_card_number` (text, nullable) - CPCS card number  
    - `npors_card_number` (text, nullable) - NPORS card number

  2. Notes
    - All fields are optional as not all candidates will have these card numbers
    - These fields will be auto-populated from booking form delegates when available
*/

ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS citb_hse_number text,
ADD COLUMN IF NOT EXISTS cpcs_card_number text,
ADD COLUMN IF NOT EXISTS npors_card_number text;
