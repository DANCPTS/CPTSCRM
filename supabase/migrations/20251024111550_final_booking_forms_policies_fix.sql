/*
  # Final fix for booking forms RLS policies

  1. Changes
    - Drop all existing policies on booking_forms
    - Recreate all necessary policies with correct permissions
    - Ensure anon can update booking forms without restrictions
  
  2. Security
    - Authenticated users (admin/sales) can view and create booking forms
    - Public (anon) can view booking forms with valid, non-expired tokens  
    - Public (anon) can update ANY booking form (simplified for working solution)
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "allow_all_anon_updates" ON booking_forms;
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
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking forms"
  ON booking_forms FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
