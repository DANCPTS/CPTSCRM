/*
  # Add email_sent tracking to booking forms

  1. Changes
    - Add `email_sent` boolean column to booking_forms table
    - Defaults to false
    - Allows tracking whether the booking form email has been sent to customer
*/

ALTER TABLE booking_forms 
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;