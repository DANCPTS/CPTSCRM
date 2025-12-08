/*
  # Remove email and phone duplicates separately

  1. Changes
    - Remove contacts with duplicate emails (keep oldest)
    - Remove contacts with duplicate phone numbers (keep oldest)
    - Update bookings to reference the kept contact
    - Add UNIQUE constraint to email column
    - Add UNIQUE constraint to phone column
  
  2. Notes
    - Processes email duplicates first
    - Then processes phone duplicates
    - For each duplicate group, keeps the oldest record (by created_at)
    - Updates all bookings to point to the kept contact before deletion
*/

DO $$
DECLARE
  duplicate_record RECORD;
  keep_id uuid;
  ids_to_delete uuid[];
  delete_id uuid;
BEGIN
  FOR duplicate_record IN
    SELECT email, array_agg(id ORDER BY created_at) as ids
    FROM contacts 
    WHERE email IS NOT NULL
    GROUP BY email
    HAVING COUNT(*) > 1
  LOOP
    keep_id := duplicate_record.ids[1];
    ids_to_delete := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
    
    FOREACH delete_id IN ARRAY ids_to_delete
    LOOP
      UPDATE bookings SET contact_id = keep_id WHERE contact_id = delete_id;
    END LOOP;
    
    DELETE FROM contacts WHERE id = ANY(ids_to_delete);
  END LOOP;
  
  FOR duplicate_record IN
    SELECT phone, array_agg(id ORDER BY created_at) as ids
    FROM contacts 
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
  LOOP
    keep_id := duplicate_record.ids[1];
    ids_to_delete := duplicate_record.ids[2:array_length(duplicate_record.ids, 1)];
    
    FOREACH delete_id IN ARRAY ids_to_delete
    LOOP
      UPDATE bookings SET contact_id = keep_id WHERE contact_id = delete_id;
    END LOOP;
    
    DELETE FROM contacts WHERE id = ANY(ids_to_delete);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_email_key' 
    AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_email_key UNIQUE (email);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_phone_key' 
    AND conrelid = 'contacts'::regclass
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_phone_key UNIQUE (phone);
  END IF;
END $$;