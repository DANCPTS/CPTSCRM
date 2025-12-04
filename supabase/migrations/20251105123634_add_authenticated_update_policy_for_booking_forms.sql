/*
  # Add authenticated user update policy for booking forms

  1. Changes
    - Add UPDATE policy for authenticated admin/sales users to update booking forms
    - This allows staff to update invoice details and other fields

  2. Security
    - Only authenticated users with admin or sales role can update
    - This matches the existing SELECT and INSERT policies
*/

CREATE POLICY "Authenticated users can update booking forms"
  ON booking_forms
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'sales')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'sales')
    )
  );
