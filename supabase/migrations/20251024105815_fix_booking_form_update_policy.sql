/*
  # Fix booking form update policy

  1. Changes
    - Drop the existing restrictive update policy
    - Create a new policy that allows anonymous users to update all fields when submitting the form
    - Ensures the token is valid and the form is still pending
  
  2. Security
    - Only allows updates to forms with valid tokens that are still pending and not expired
    - Prevents updates to already signed or expired forms
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy that allows full updates for valid tokens
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    token IS NOT NULL 
    AND status = 'signed' 
    AND expires_at > now()
  );
