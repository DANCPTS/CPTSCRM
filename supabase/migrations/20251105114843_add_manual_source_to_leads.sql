/*
  # Add Manual Source to Leads

  1. Changes
    - Update leads table source constraint to include 'manual' option
    - This allows tracking manually-entered leads separately from email-imported leads
  
  2. Purpose
    - Differentiate manual leads (entered through UI) from email leads (imported via email button)
    - Enable separate statistics for email vs manual lead performance
    - Track conversion rates for different lead entry methods
*/

-- Drop the existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

-- Add new constraint with 'manual' included
ALTER TABLE leads ADD CONSTRAINT leads_source_check 
  CHECK (source IN ('web', 'email', 'manual', 'phone', 'referral'));
