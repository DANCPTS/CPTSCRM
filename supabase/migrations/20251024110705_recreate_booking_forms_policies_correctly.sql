/*
  # Recreate booking forms policies correctly

  1. Changes
    - Drop all existing policies
    - Recreate with proper USING and WITH CHECK clauses
    - Use simple, working policy structure
  
  2. Security
    - Authenticated users (admin/sales) can view and create all booking forms
    - Public (anon) can view booking forms with valid token that are pending and not expired
    - Public (anon) can update booking forms with valid token that are pending and not expired
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "anon_select_booking_forms" ON booking_forms;
DROP POLICY IF EXISTS "anon_update_booking_forms" ON booking_forms;
DROP POLICY IF EXISTS "Public can update booking form with valid token" ON booking_forms;
DROP POLICY IF EXISTS "Public can view booking form by token" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can view all booking forms" ON booking_forms;
DROP POLICY IF EXISTS "Authenticated users can create booking forms" ON booking_forms;

-- Authenticated users policies
CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

-- Public (anon) policies
CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (true);
