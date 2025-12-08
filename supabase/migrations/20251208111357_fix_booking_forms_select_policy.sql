/*
  # Fix booking forms select policy

  1. Changes
    - Simplify the SELECT policy for booking_forms to allow any authenticated user
    - This ensures users can view the booking forms they create
    - Maintains separate policy for public token-based access

  2. Security
    - Authenticated users can view all booking forms
    - Public users can only view forms with valid tokens
*/

DROP POLICY IF EXISTS "Authenticated users can view all booking forms" ON booking_forms;

CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (true);
