/*
  # Auto-create candidates from booking forms

  1. Changes
    - Create a trigger function that automatically creates candidate profiles
    - When a booking form is signed, parse the delegate names and create candidates
    - Link candidates to the course through candidate_courses table

  2. Behavior
    - Triggers when booking_form status changes to 'signed'
    - Parses delegate_names from form_data (each line is one candidate)
    - Creates a candidate profile for each delegate
    - Uses the contact information from the booking form
    - Links candidates to the course specified in the booking

  3. Notes
    - Skips candidates that already exist (based on name match)
    - Sets created_by to the first admin user found
    - Status is set to 'active' by default
*/

CREATE OR REPLACE FUNCTION auto_create_candidates_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_delegate_names text;
  v_delegate_name text;
  v_first_name text;
  v_last_name text;
  v_contact_email text;
  v_contact_phone text;
  v_course_name text;
  v_course_id uuid;
  v_candidate_id uuid;
  v_admin_user_id uuid;
  v_delegate_array text[];
  v_name_parts text[];
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the first admin user to use as created_by
    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    IF v_admin_user_id IS NULL THEN
      RAISE WARNING 'No admin user found, skipping candidate creation';
      RETURN NEW;
    END IF;
    
    -- Extract delegate names from form_data
    v_delegate_names := NEW.form_data->>'delegate_names';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';
    
    -- Find the course_id based on course name
    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE name = v_course_name LIMIT 1;
    END IF;
    
    IF v_delegate_names IS NOT NULL AND v_delegate_names != '' THEN
      -- Split delegate names by newline
      v_delegate_array := string_to_array(v_delegate_names, E'\n');
      
      -- Process each delegate
      FOREACH v_delegate_name IN ARRAY v_delegate_array
      LOOP
        -- Trim whitespace
        v_delegate_name := trim(v_delegate_name);
        
        -- Skip empty lines
        IF v_delegate_name = '' THEN
          CONTINUE;
        END IF;
        
        -- Parse name into first and last name
        v_name_parts := string_to_array(v_delegate_name, ' ');
        
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;
        
        -- Check if candidate already exists
        SELECT id INTO v_candidate_id 
        FROM candidates 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;
        
        -- Create candidate if doesn't exist
        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            email,
            phone,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_contact_email,
            v_contact_phone,
            'active',
            v_admin_user_id
          )
          RETURNING id INTO v_candidate_id;
          
          RAISE NOTICE 'Created candidate: % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        ELSE
          RAISE NOTICE 'Candidate already exists: % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        END IF;
        
        -- Link candidate to course if course was found
        IF v_candidate_id IS NOT NULL AND v_course_id IS NOT NULL THEN
          -- Check if enrollment already exists
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses 
            WHERE candidate_id = v_candidate_id 
              AND course_id = v_course_id
          ) THEN
            INSERT INTO candidate_courses (
              candidate_id,
              course_id,
              enrollment_date,
              status,
              created_by
            ) VALUES (
              v_candidate_id,
              v_course_id,
              CURRENT_DATE,
              'enrolled',
              v_admin_user_id
            );
            
            RAISE NOTICE 'Enrolled candidate % in course %', v_candidate_id, v_course_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_create_candidates ON booking_forms;

-- Create trigger
CREATE TRIGGER trigger_auto_create_candidates
  AFTER INSERT OR UPDATE ON booking_forms
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_candidates_from_booking();
