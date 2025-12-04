/*
  # Make candidates.created_by nullable
  
  1. Changes
    - Change created_by column to allow NULL values
    
  2. Why
    - The auto_create_candidates_from_booking trigger needs to create candidates
    - Sometimes it may not find an admin user to assign as created_by
    - Making it nullable allows the system to track candidates even without a creator
    - This is acceptable for candidates auto-created from booking forms
*/

-- Make created_by nullable
ALTER TABLE candidates ALTER COLUMN created_by DROP NOT NULL;
