/*
  # Fix Users Table SELECT Policy

  1. Changes
    - Drop the existing "Users can view all users" policy
    - Create a new policy that allows authenticated users to view all users
    - This fixes the "Database error querying schema" issue during login
*/

DROP POLICY IF EXISTS "Users can view all users" ON users;

CREATE POLICY "Authenticated users can view all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);
