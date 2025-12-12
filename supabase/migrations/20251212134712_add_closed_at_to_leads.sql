/*
  # Add closed_at tracking to leads

  1. Changes
    - Add `closed_at` timestamp column to leads table
    - Create trigger function to automatically set closed_at when status changes to 'won' or 'lost'
    - Create trigger to call the function on lead updates
    - Backfill closed_at for existing won/lost leads using updated_at

  2. Purpose
    - Track when leads are closed (won or lost)
    - Allow filtering of old closed leads from pipeline view
    - Maintain historical data while keeping pipeline clean
*/

-- Add closed_at column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Create function to automatically set closed_at when status changes to won/lost
CREATE OR REPLACE FUNCTION set_lead_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If status is changing to 'won' or 'lost', set closed_at to now
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost')) THEN
    NEW.closed_at = now();
  END IF;
  
  -- If status is changing from 'won' or 'lost' to something else, clear closed_at
  IF NEW.status NOT IN ('won', 'lost') AND OLD.status IN ('won', 'lost') THEN
    NEW.closed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set closed_at
DROP TRIGGER IF EXISTS set_lead_closed_at_trigger ON leads;
CREATE TRIGGER set_lead_closed_at_trigger
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION set_lead_closed_at();

-- Backfill closed_at for existing won/lost leads using updated_at as best estimate
UPDATE leads
SET closed_at = updated_at
WHERE status IN ('won', 'lost')
AND closed_at IS NULL;
