/*
  # Fix User Signup Policy
  
  1. Changes
    - Update the INSERT policy on users table to allow new users to create their own profile
    - The policy checks if the new user's ID matches the authenticated user's ID
    
  2. Security
    - Users can only insert their own profile (auth.uid() = NEW.id)
    - Admins can still insert any user profile
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Only admins can insert users" ON users;

-- Create a new policy that allows users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile during signup"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );