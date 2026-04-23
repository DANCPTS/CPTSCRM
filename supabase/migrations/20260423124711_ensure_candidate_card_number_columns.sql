/*
  # Ensure candidate card number columns exist

  1. Changes
    - Adds `citb_hse_number`, `cpcs_card_number`, `npors_card_number` to candidates
      if they are missing. The prior migration (20260107101549) appears to not
      have been applied to this environment.

  2. Security
    - No RLS changes.
*/

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS citb_hse_number text,
  ADD COLUMN IF NOT EXISTS cpcs_card_number text,
  ADD COLUMN IF NOT EXISTS npors_card_number text;
