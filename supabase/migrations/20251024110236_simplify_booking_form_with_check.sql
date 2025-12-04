/*
  # Simplify booking form WITH CHECK clause

  1. Changes
    - Remove expires_at check from WITH CHECK since we're not modifying it
    - Only validate that token still exists in the updated row
  
  2. Security
    - USING clause validates the current state (pending, not expired)
    - WITH CHECK only ensures token isn't removed
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a simplified policy
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
  );
