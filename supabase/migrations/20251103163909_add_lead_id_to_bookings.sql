/*
  # Add lead_id to bookings table

  1. Changes
    - Add lead_id column to bookings table as optional foreign key
    - This allows tracking which lead generated the booking
    - Enables showing "Invoice" button when candidates are booked

  2. Notes
    - Column is nullable since existing bookings may not have a lead
    - Future bookings can link back to the originating lead
*/

-- Add lead_id column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON bookings(lead_id);

-- Update existing bookings to link to leads where possible (match by company)
UPDATE bookings b
SET lead_id = (
  SELECT l.id 
  FROM leads l
  WHERE l.company_id = b.company_id
    AND l.status = 'won'
  ORDER BY l.updated_at DESC
  LIMIT 1
)
WHERE b.lead_id IS NULL
  AND b.company_id IS NOT NULL;
