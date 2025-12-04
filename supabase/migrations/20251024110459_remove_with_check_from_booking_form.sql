/*
  # Remove WITH CHECK from booking form update policy

  1. Changes
    - Remove WITH CHECK clause entirely to allow all updates
    - Keep USING clause to validate current state
  
  2. Security
    - USING clause validates the current state (pending, not expired, has token)
    - No WITH CHECK means any values can be set in the update
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy without WITH CHECK
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  );
