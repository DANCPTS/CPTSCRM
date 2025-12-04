/*
  # Add invoice tracking to booking forms

  1. Changes
    - Add invoice_sent boolean to booking_forms table to track invoice status
    - Add invoice_number text to booking_forms table to store invoice reference
    - Default invoice_sent to false

  2. Notes
    - This allows tracking invoices before a booking is created
    - Ensures the workflow: Sign Form → Send Invoice → Create Booking
*/

ALTER TABLE booking_forms 
ADD COLUMN IF NOT EXISTS invoice_sent boolean DEFAULT false;

ALTER TABLE booking_forms 
ADD COLUMN IF NOT EXISTS invoice_number text;
