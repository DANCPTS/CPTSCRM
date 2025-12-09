/*
  # Add authenticated user update policy for booking_forms

  1. Changes
    - Add UPDATE policy for authenticated users on booking_forms table
    - Allows authenticated users to update all booking form fields including invoice details

  2. Security
    - Policy restricted to authenticated users only
    - Allows updates to invoice_sent and invoice_number fields
*/

-- Drop existing authenticated policies if they exist to recreate them properly
DROP POLICY IF EXISTS "Authenticated users can update booking forms" ON booking_forms;

-- Create new update policy for authenticated users
CREATE POLICY "Authenticated users can update booking forms"
  ON booking_forms
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
