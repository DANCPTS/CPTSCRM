/*
  # Add Stripe Payment Link Support

  1. New Columns on booking_forms
    - `payment_type` (text) - Type of payment: 'invoice' or 'stripe'
    - `payment_link` (text) - Stripe payment link URL
    - `payment_link_sent` (boolean) - Whether payment link email was sent
    - `payment_link_sent_at` (timestamptz) - When the payment link was sent

  2. Notes
    - Allows tracking Stripe payments separately from traditional invoicing
    - Stores the Stripe payment link URL for easy reference
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