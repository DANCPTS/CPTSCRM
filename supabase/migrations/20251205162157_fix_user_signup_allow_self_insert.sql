/*
  # Fix User Signup - Allow Self Insert

  1. Changes
    - Drop the existing insert policy that's blocking profile creation
    - Create a new policy that allows:
      - Users to create their own profile when no users exist (first admin)
      - Users to create their own profile if they're inserting their own ID
      - Admins to create any user profile

  2. Security
    - Ensures first user can become admin
    - Allows authenticated users to create their own profile
    - Maintains admin control for creating additional users
*/

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Allow first user signup or admin insert" ON users;

-- Create new policy that allows self-insert or admin insert
CREATE POLICY "Allow self-insert for first user or admin creates users"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow if no users exist (first signup becomes admin)
    NOT EXISTS (SELECT 1 FROM users)
    OR
    -- Allow users to insert their own profile
    id = auth.uid()
    OR
    -- Or if an admin is creating the user
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
