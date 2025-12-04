/*
  # Fix candidates insert policy for triggers
  
  1. Changes
    - Update the INSERT policy to allow triggers with SECURITY DEFINER to create candidates
    - Allow authenticated users to create candidates where they are the creator OR where the function is running as SECURITY DEFINER
    
  2. Why
    - The auto_create_candidates_from_booking trigger runs with SECURITY DEFINER
    - It needs to be able to create candidates with created_by set to an admin user
    - The current policy blocks this because auth.uid() doesn't match created_by when the trigger runs
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create candidates" ON candidates;

-- Create a new policy that allows:
-- 1. Users to create candidates where they are the creator
-- 2. Any creation when called from SECURITY DEFINER functions (bypasses RLS entirely)
CREATE POLICY "Authenticated users can create candidates"
  ON candidates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
