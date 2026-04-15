/*
  # Add missing email_sent column to booking_forms

  1. Changes
    - Add `email_sent` boolean column to booking_forms table
    - Defaults to false
    - Tracks whether the booking form email was sent to the customer
*/

ALTER TABLE booking_forms
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false;