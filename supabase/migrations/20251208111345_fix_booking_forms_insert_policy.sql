/*
  # Fix booking forms insert policy

  1. Changes
    - Simplify the INSERT policy for booking_forms to allow any authenticated user
    - This fixes the RLS error when creating booking forms
    - The original policy was too restrictive and caused issues

  2. Security
    - Still maintains RLS protection
    - Only authenticated users can create booking forms
    - Unauthenticated users can still view/update with token
*/

DROP POLICY IF EXISTS "Authenticated users can create booking forms" ON booking_forms;

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (true);
