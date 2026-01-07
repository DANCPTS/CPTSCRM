/*
  # Add VAT Exempt and Payment Link Support to Bookings

  1. Changes to Bookings Table
    - `vat_exempt` (boolean, default false) - Whether the booking is VAT-exempt (e.g., Dubai account)
    - `net_amount` (decimal) - Base price before VAT
    - `vat_amount` (decimal) - VAT portion (0 if exempt)
    - `payment_link` (text) - Manually-entered Stripe payment link URL

  2. Data Migration
    - Calculate and populate net_amount and vat_amount for existing bookings
    - Assumes all existing bookings have VAT (vat_exempt = false)
    - Net amount = amount (existing amount is treated as net)
    - VAT amount = amount * 0.20 (20% VAT)
    - Note: The existing `amount` column remains as the net/base price

  3. Notes
    - Payment links are added manually by staff after creating Stripe links
    - VAT is calculated at 20% rate (UK standard rate)
    - VAT-exempt bookings will have vat_amount = 0
*/

-- Add new columns to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'vat_exempt'
  ) THEN
    ALTER TABLE bookings ADD COLUMN vat_exempt boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'net_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN net_amount decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'vat_amount'
  ) THEN
    ALTER TABLE bookings ADD COLUMN vat_amount decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE bookings ADD COLUMN payment_link text;
  END IF;
END $$;

-- Populate net_amount and vat_amount for existing bookings
-- Treat existing amount as the net amount and calculate 20% VAT
UPDATE bookings
SET 
  net_amount = COALESCE(amount, 0),
  vat_amount = COALESCE(amount, 0) * 0.20,
  vat_exempt = false
WHERE net_amount IS NULL;
