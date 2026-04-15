/*
  # Add payment columns to booking_forms

  1. Modified Tables
    - `booking_forms`
      - `payment_type` (text, default 'invoice') - Type of payment: 'invoice' or 'stripe'
      - `payment_link` (text, nullable) - Stripe payment link URL
      - `payment_link_sent` (boolean, default false) - Whether payment link has been sent
      - `payment_link_sent_at` (timestamptz, nullable) - When payment link was sent

  2. Important Notes
    - These columns support both traditional invoice and Stripe payment workflows
    - Existing rows default to 'invoice' payment type
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN payment_type text DEFAULT 'invoice';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'payment_link'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN payment_link text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'payment_link_sent'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN payment_link_sent boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'booking_forms' AND column_name = 'payment_link_sent_at'
  ) THEN
    ALTER TABLE booking_forms ADD COLUMN payment_link_sent_at timestamptz;
  END IF;
END $$;