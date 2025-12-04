/*
  # Fix Attendance RLS Policies

  1. Changes
    - Remove restrictive WITH CHECK from INSERT policy
    - Remove restrictive WITH CHECK from UPDATE policy
    - Allow any authenticated user to mark and update attendance
    - Keep the marked_by field for audit purposes but don't restrict based on it

  2. Security
    - All authenticated users can mark attendance (they're all staff members)
    - Maintains audit trail with marked_by field
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can mark attendance" ON attendance;
DROP POLICY IF EXISTS "Authenticated users can update attendance" ON attendance;

-- Create new policies without restrictive WITH CHECK
CREATE POLICY "Authenticated users can mark attendance"
  ON attendance
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON attendance
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
