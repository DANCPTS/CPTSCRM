/*
  # Add Email Source to Leads

  1. Changes
    - Update leads table source constraint to include 'email' option
    - This allows tracking leads from email imports separately from website/Google Ads leads
  
  2. Purpose
    - Differentiate email-imported leads from website leads
    - Enable separate statistics for email vs website lead performance
    - Track conversion rates for different lead sources
*/

-- Drop the existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;

-- Add new constraint with 'email' included
ALTER TABLE leads ADD CONSTRAINT leads_source_check 
  CHECK (source IN ('web', 'email', 'phone', 'referral'));
