/*
  # Add Email Import Source

  1. Changes
    - Update leads table source constraint to include 'email_import' option
    - This separates email-imported leads (Google Ads) from manual email leads
  
  2. Purpose
    - 'email_import' = leads from email upload button (Google Ads) → email statistics
    - 'email', 'phone', 'referral' = manually entered leads → manual statistics
*/

-- Drop the existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

-- Add new constraint with 'email_import' included
ALTER TABLE leads ADD CONSTRAINT leads_source_check 
  CHECK (source IN ('email_import', 'email', 'phone', 'referral', 'web', 'manual'));
