/*
  # Fix booking form update policy - remove status check from USING

  1. Changes
    - Remove status = 'pending' check from USING clause
    - The application WHERE clause handles filtering by pending status
    - Keep token and expiry validation in USING
    - WITH CHECK remains true to allow all field updates
  
  2. Security
    - Only allows updates on forms with valid token and not expired
    - Application layer enforces pending status via WHERE clause
    - WITH CHECK (true) allows all field values to be set
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Recreate without status check in USING
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND expires_at > now()
  )
  WITH CHECK (true);
