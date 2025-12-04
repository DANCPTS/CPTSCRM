/*
  # Add company_id to leads table

  1. Changes
    - Add `company_id` column to `leads` table (foreign key to companies)
    - This allows leads to be linked to company records automatically
    - When a lead is created with a company name, a company record will be created or linked
  
  2. Notes
    - Column is optional (nullable) since not all leads may have companies
    - Foreign key constraint ensures data integrity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;
END $$;
