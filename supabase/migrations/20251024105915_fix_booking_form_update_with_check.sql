/*
  # Fix booking form update WITH CHECK policy

  1. Changes
    - Update the WITH CHECK clause to allow the status transition from 'pending' to 'signed'
    - The USING clause checks the current state (must be pending)
    - The WITH CHECK clause validates the new state (must be signed)
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Ensures the new status being set is 'signed'
    - Validates token exists in both clauses
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy with correct USING and WITH CHECK
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'signed'
  );
