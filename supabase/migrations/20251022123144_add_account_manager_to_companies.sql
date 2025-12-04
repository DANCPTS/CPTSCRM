/*
  # Add Account Manager to Companies

  1. Changes
    - Add `account_manager_id` column to `companies` table
    - Foreign key reference to `users` table
    - Allows tracking which user manages each company account

  2. Notes
    - Column is nullable to allow companies without assigned managers
    - Uses CASCADE to handle user deletions safely
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'account_manager_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN account_manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_companies_account_manager_id ON companies(account_manager_id);