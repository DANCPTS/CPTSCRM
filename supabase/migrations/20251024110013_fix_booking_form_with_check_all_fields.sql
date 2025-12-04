/*
  # Fix booking form update policy to allow all field updates

  1. Changes
    - Update WITH CHECK to allow any field values except enforce status must be 'signed'
    - The USING clause checks the current state (must be pending and not expired)
    - The WITH CHECK clause only validates that status is being set to 'signed'
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Ensures the new status being set is 'signed'
    - Allows updates to all other fields (form_data, signature_data, etc.)
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a new policy that allows updating all fields when submitting
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
    AND expires_at > now()
  );
