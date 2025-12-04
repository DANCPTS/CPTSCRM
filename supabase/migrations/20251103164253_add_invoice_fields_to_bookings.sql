/*
  # Add invoice fields to bookings table

  1. Changes
    - Add invoice_sent boolean field to track if invoice has been sent
    - Add invoice_number text field to store the invoice number
    - Add joining_instructions_sent boolean to track if joining instructions have been sent

  2. Notes
    - All fields are nullable for backwards compatibility
    - Default values set to false for boolean fields
*/

-- Add invoice_sent field
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS invoice_sent boolean DEFAULT false;

-- Add invoice_number field
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS invoice_number text;

-- Add joining_instructions_sent field
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS joining_instructions_sent boolean DEFAULT false;
