/*
  # Add proposal/quote details to leads table

  1. Changes
    - Add `quoted_course` (text) - The course name that was quoted
    - Add `quoted_price` (decimal) - The quoted price
    - Add `quoted_currency` (text) - Currency code (default GBP)
    - Add `quoted_dates` (text) - Proposed course dates
    - Add `quoted_venue` (text) - Proposed course venue
    - Add `number_of_delegates` (integer) - Number of delegates quoted for
    - Add `quote_notes` (text) - Additional notes about the quote

  2. Notes
    - These fields are used when a lead moves to 'proposal' status
    - They pre-populate the booking form when sent to the client
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_course'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_course text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_price'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_price decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_currency'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_currency text DEFAULT 'GBP';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_dates'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_dates text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quoted_venue'
  ) THEN
    ALTER TABLE leads ADD COLUMN quoted_venue text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'number_of_delegates'
  ) THEN
    ALTER TABLE leads ADD COLUMN number_of_delegates integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'quote_notes'
  ) THEN
    ALTER TABLE leads ADD COLUMN quote_notes text;
  END IF;
END $$;
