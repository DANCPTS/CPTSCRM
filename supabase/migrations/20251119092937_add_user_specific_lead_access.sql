/*
  # Update Lead Access to be User-Specific

  This migration updates Row Level Security policies for the leads table to ensure
  each user can only see and manage their own leads (based on assigned_to field),
  while admins can see all leads.

  ## Changes

  1. **Drop existing lead policies**
     - Remove the "Authenticated users can view leads" policy that allows all users to see all leads
     - Remove existing insert/update/delete policies

  2. **Create new user-specific policies**
     - SELECT: Users can view leads assigned to them, or all leads if they're an admin
     - INSERT: Sales and admins can insert leads (they become the assigned_to user by default)
     - UPDATE: Users can update leads assigned to them, or all leads if they're an admin
     - DELETE: Only admins can delete leads

  3. **Add default assigned_to**
     - Update the leads table to automatically set assigned_to to the creating user

  ## Security

  - Users can only access their own assigned leads
  - Admins have full access to all leads
  - Sales users can create leads and they're automatically assigned to them
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view leads" ON leads;
DROP POLICY IF EXISTS "Sales and admins can insert leads" ON leads;
DROP POLICY IF EXISTS "Sales and admins can update leads" ON leads;
DROP POLICY IF EXISTS "Only admins can delete leads" ON leads;

-- Add created_by field to track who created the lead
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE leads ADD COLUMN created_by uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create new user-specific policies
CREATE POLICY "Users can view their assigned leads or admins can view all"
  ON leads FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Sales and admins can insert leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Users can update their assigned leads or admins can update all"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Only admins can delete leads"
  ON leads FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create function to auto-assign leads to creator
CREATE OR REPLACE FUNCTION auto_assign_lead_to_creator()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_to is not set, assign to the creating user
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := auth.uid();
  END IF;
  
  -- Always set created_by to the creating user
  NEW.created_by := auth.uid();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS auto_assign_lead_trigger ON leads;
CREATE TRIGGER auto_assign_lead_trigger
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_lead_to_creator();
