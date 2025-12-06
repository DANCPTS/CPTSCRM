/*
  # Add Foreign Key Constraint to Companies Table

  1. Changes
    - Add foreign key constraint from companies.account_manager_id to users.id
  
  2. Notes
    - Enables proper joins in Supabase queries
    - Ensures data integrity for account manager assignments
*/

-- Add foreign key for account_manager_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'companies_account_manager_id_fkey'
    AND table_name = 'companies'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_account_manager_id_fkey
    FOREIGN KEY (account_manager_id) REFERENCES users(id);
  END IF;
END $$;
