/*
  # Add Foreign Key Constraints to Leads Table

  1. Changes
    - Add foreign key constraint from leads.assigned_to to users.id
    - Add foreign key constraint from leads.created_by to users.id
  
  2. Notes
    - These constraints enable proper joins in Supabase queries
    - They ensure data integrity by preventing orphaned records
*/

-- Add foreign key for assigned_to if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leads_assigned_to_fkey'
    AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES users(id);
  END IF;
END $$;

-- Add foreign key for created_by if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'leads_created_by_fkey'
    AND table_name = 'leads'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;
