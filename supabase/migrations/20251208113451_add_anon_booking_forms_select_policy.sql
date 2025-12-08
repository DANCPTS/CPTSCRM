/*
  # Add anonymous SELECT policy for booking forms

  1. Changes
    - Add policy to allow anonymous users to view booking forms with valid tokens
    - This enables the public booking form page to load
  
  2. Security
    - Anonymous users can only view booking forms with non-expired tokens
*/

DROP POLICY IF EXISTS "Public can view booking form by token" ON booking_forms;

CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND expires_at > now()
  );
