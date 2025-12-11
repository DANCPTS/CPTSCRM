/*
  # Make bookings.contact_id nullable
  
  1. Changes
    - Make bookings.contact_id column nullable to allow deletion of contacts
    - This aligns with the foreign key constraint that uses ON DELETE SET NULL
    
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE bookings 
ALTER COLUMN contact_id DROP NOT NULL;
