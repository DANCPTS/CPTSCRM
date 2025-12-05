/*
  # Allow First Admin User Signup

  1. Changes
    - Modify the user insert policy to allow signup when no users exist yet
    - This enables the first admin account to be created
    - Subsequent users still require admin approval

  2. Security
    - If no users exist in the system, allow insert
    - If users exist, require existing admin to create new users
*/

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Only admins can insert users" ON users;

-- Create new policy that allows first user or admin-created users
CREATE POLICY "Allow first user signup or admin insert"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if no users exist (first signup)
    NOT EXISTS (SELECT 1 FROM users)
    OR
    -- Or if an admin is creating the user
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
