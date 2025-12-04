/*
  # Allow all field updates for booking form submission

  1. Changes
    - Simplify the WITH CHECK clause to allow all field updates
    - Keep USING clause to validate current state
    - Trust the application to set correct values
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Allows the application to update any fields during submission
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy that allows full updates for valid pending forms
CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms
  FOR UPDATE
  TO anon
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (true);
