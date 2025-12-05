/*
  # Remove Duplicate Contacts

  1. Purpose
    - Identify and remove duplicate contacts from the database
    - Keep the oldest contact (by created_at) for each duplicate group
    - Update all references to duplicates to point to the kept contact
    
  2. Duplicate Detection Criteria
    - Contacts with the same email address (case-insensitive)
    - OR contacts with the same first name, last name, and company_id
    
  3. Process
    - Find all duplicate groups
    - For each group, keep the oldest contact
    - Update bookings to reference the kept contact
    - Update any other references
    - Delete the duplicate contacts
    
  4. Safety
    - This is a one-time cleanup operation
    - Uses SECURITY DEFINER to bypass RLS for data cleanup
*/

-- Create a temporary function to remove duplicates
CREATE OR REPLACE FUNCTION remove_duplicate_contacts()
RETURNS TABLE(
  duplicates_removed integer,
  contacts_kept integer,
  bookings_updated integer
) AS $$
DECLARE
  v_duplicates_removed integer := 0;
  v_contacts_kept integer := 0;
  v_bookings_updated integer := 0;
  v_rows_affected integer := 0;
  v_kept_contact_id uuid;
  v_duplicate_id uuid;
  v_duplicate_group RECORD;
BEGIN
  -- Process duplicates by email
  FOR v_duplicate_group IN
    SELECT 
      lower(email) as email_lower,
      array_agg(id ORDER BY created_at ASC) as contact_ids,
      count(*) as duplicate_count
    FROM contacts
    WHERE email IS NOT NULL 
      AND trim(email) != ''
    GROUP BY lower(email)
    HAVING count(*) > 1
  LOOP
    -- Keep the first (oldest) contact
    v_kept_contact_id := v_duplicate_group.contact_ids[1];
    v_contacts_kept := v_contacts_kept + 1;
    
    -- Update all references to duplicates
    FOR i IN 2..array_length(v_duplicate_group.contact_ids, 1)
    LOOP
      v_duplicate_id := v_duplicate_group.contact_ids[i];
      
      -- Update bookings
      UPDATE bookings 
      SET contact_id = v_kept_contact_id 
      WHERE contact_id = v_duplicate_id;
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      v_bookings_updated := v_bookings_updated + v_rows_affected;
      
      -- Delete the duplicate contact
      DELETE FROM contacts WHERE id = v_duplicate_id;
      v_duplicates_removed := v_duplicates_removed + 1;
      
      RAISE NOTICE 'Removed duplicate contact ID: %, kept ID: %', v_duplicate_id, v_kept_contact_id;
    END LOOP;
  END LOOP;
  
  -- Process duplicates by name + company (excluding those without email)
  FOR v_duplicate_group IN
    SELECT 
      lower(first_name) as first_name_lower,
      lower(last_name) as last_name_lower,
      company_id,
      array_agg(id ORDER BY created_at ASC) as contact_ids,
      count(*) as duplicate_count
    FROM contacts
    WHERE (email IS NULL OR trim(email) = '')
    GROUP BY lower(first_name), lower(last_name), company_id
    HAVING count(*) > 1
  LOOP
    -- Keep the first (oldest) contact
    v_kept_contact_id := v_duplicate_group.contact_ids[1];
    v_contacts_kept := v_contacts_kept + 1;
    
    -- Update all references to duplicates
    FOR i IN 2..array_length(v_duplicate_group.contact_ids, 1)
    LOOP
      v_duplicate_id := v_duplicate_group.contact_ids[i];
      
      -- Update bookings
      UPDATE bookings 
      SET contact_id = v_kept_contact_id 
      WHERE contact_id = v_duplicate_id;
      
      GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
      v_bookings_updated := v_bookings_updated + v_rows_affected;
      
      -- Delete the duplicate contact
      DELETE FROM contacts WHERE id = v_duplicate_id;
      v_duplicates_removed := v_duplicates_removed + 1;
      
      RAISE NOTICE 'Removed duplicate contact ID: %, kept ID: %', v_duplicate_id, v_kept_contact_id;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT v_duplicates_removed, v_contacts_kept, v_bookings_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the deduplication
SELECT * FROM remove_duplicate_contacts();

-- Drop the temporary function
DROP FUNCTION remove_duplicate_contacts();