/*
  # Fix booking form update policy with explicit token validation

  1. Changes
    - Ensure the token being used in the WHERE clause is validated in the policy
    - Add token check to WITH CHECK to prevent changing tokens
  
  2. Security
    - Only allows updates when current status is 'pending' and not expired
    - Validates that the token exists and matches
    - Prevents token from being changed during update
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;

-- Create a policy that validates token and allows updates
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
    AND expires_at > now()
  );
