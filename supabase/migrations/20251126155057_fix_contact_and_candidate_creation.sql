/*
  # Fix Contact and Candidate Creation from Booking Forms

  1. Changes
    - Update auto_create_candidates trigger to also create a contact for the booker
    - Candidates should be created with delegate-specific information
    - Booker (contact_name, contact_email, contact_phone) should be added as a contact

  2. Behavior
    - When a booking form is signed:
      - Create a contact for the booker and link to the company
      - Create candidates for each delegate (without booker's email/phone)
      - Link candidates to the course run
*/

CREATE OR REPLACE FUNCTION auto_create_candidates_from_booking()
RETURNS TRIGGER AS $$
DECLARE
  v_delegate jsonb;
  v_delegate_name text;
  v_first_name text;
  v_last_name text;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_course_name text;
  v_course_id uuid;
  v_course_run_id uuid;
  v_candidate_id uuid;
  v_contact_id uuid;
  v_admin_user_id uuid;
  v_name_parts text[];
  v_ni_number text;
  v_dob text;
  v_address text;
  v_postcode text;
  v_company_id uuid;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the first admin user to use as created_by
    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    -- Extract booker information
    v_contact_name := NEW.form_data->>'contact_name';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';
    
    -- Get company_id from the lead
    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO v_company_id
      FROM leads
      WHERE id = NEW.lead_id
      LIMIT 1;
    END IF;
    
    -- Create or update the contact (booker) if we have their information
    IF v_contact_name IS NOT NULL AND trim(v_contact_name) != '' THEN
      -- Parse contact name into first and last name
      v_name_parts := string_to_array(trim(v_contact_name), ' ');
      
      IF array_length(v_name_parts, 1) >= 2 THEN
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
      ELSE
        v_first_name := trim(v_contact_name);
        v_last_name := '';
      END IF;
      
      -- Check if contact already exists by email or name
      IF v_contact_email IS NOT NULL AND trim(v_contact_email) != '' THEN
        SELECT id INTO v_contact_id 
        FROM contacts 
        WHERE lower(email) = lower(trim(v_contact_email))
        LIMIT 1;
      END IF;
      
      IF v_contact_id IS NULL THEN
        SELECT id INTO v_contact_id 
        FROM contacts 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
          AND company_id = v_company_id
        LIMIT 1;
      END IF;
      
      -- Create contact if doesn't exist
      IF v_contact_id IS NULL THEN
        INSERT INTO contacts (
          first_name,
          last_name,
          email,
          phone,
          company_id,
          created_at
        ) VALUES (
          v_first_name,
          v_last_name,
          v_contact_email,
          v_contact_phone,
          v_company_id,
          now()
        )
        RETURNING id INTO v_contact_id;
        
        RAISE NOTICE 'Created contact (booker): % % (ID: %)', v_first_name, v_last_name, v_contact_id;
      ELSE
        -- Update existing contact with new information if provided
        UPDATE contacts
        SET 
          email = COALESCE(v_contact_email, email),
          phone = COALESCE(v_contact_phone, phone),
          company_id = COALESCE(v_company_id, company_id),
          updated_at = now()
        WHERE id = v_contact_id;
        
        RAISE NOTICE 'Updated contact (booker): % % (ID: %)', v_first_name, v_last_name, v_contact_id;
      END IF;
    END IF;
    
    -- Find the course_id based on course name
    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE title ILIKE '%' || v_course_name || '%' LIMIT 1;
    END IF;
    
    -- Try to find the course_run_id from the lead's booking directly
    IF NEW.lead_id IS NOT NULL THEN
      SELECT b.course_run_id INTO v_course_run_id
      FROM bookings b
      WHERE b.lead_id = NEW.lead_id
        AND b.course_run_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT 1;
    END IF;
    
    -- If no course_run found from booking, try to find an upcoming course run for the course
    IF v_course_run_id IS NULL AND v_course_id IS NOT NULL THEN
      SELECT id INTO v_course_run_id
      FROM course_runs
      WHERE course_id = v_course_id
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 1;
    END IF;
    
    -- Process delegates array from form_data
    IF NEW.form_data->'delegates' IS NOT NULL THEN
      FOR v_delegate IN SELECT * FROM jsonb_array_elements(NEW.form_data->'delegates')
      LOOP
        v_delegate_name := v_delegate->>'name';
        v_ni_number := v_delegate->>'national_insurance';
        v_dob := v_delegate->>'date_of_birth';
        v_address := v_delegate->>'address';
        v_postcode := v_delegate->>'postcode';
        
        -- Skip if name is empty
        IF v_delegate_name IS NULL OR trim(v_delegate_name) = '' THEN
          CONTINUE;
        END IF;
        
        v_delegate_name := trim(v_delegate_name);
        
        -- Parse name into first and last name
        v_name_parts := string_to_array(v_delegate_name, ' ');
        
        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;
        
        -- Check if candidate already exists by name
        SELECT id INTO v_candidate_id 
        FROM candidates 
        WHERE lower(first_name) = lower(v_first_name) 
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;
        
        -- Create candidate if doesn't exist (NOTE: No email/phone here, as delegates don't provide their own)
        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            national_insurance_number,
            date_of_birth,
            address,
            postcode,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_ni_number,
            CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE NULL END,
            v_address,
            v_postcode,
            'active',
            v_admin_user_id
          )
          RETURNING id INTO v_candidate_id;
          
          RAISE NOTICE 'Created candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        ELSE
          -- Update existing candidate with new information if provided
          UPDATE candidates
          SET 
            national_insurance_number = COALESCE(v_ni_number, national_insurance_number),
            date_of_birth = CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE date_of_birth END,
            address = COALESCE(v_address, address),
            postcode = COALESCE(v_postcode, postcode),
            updated_at = now()
          WHERE id = v_candidate_id;
          
          RAISE NOTICE 'Updated candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        END IF;
        
        -- Link candidate to course run if found
        IF v_candidate_id IS NOT NULL AND v_course_run_id IS NOT NULL THEN
          -- Check if enrollment already exists for this course run
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses 
            WHERE candidate_id = v_candidate_id 
              AND course_run_id = v_course_run_id
          ) THEN
            INSERT INTO candidate_courses (
              candidate_id,
              course_id,
              course_run_id,
              enrollment_date,
              status,
              created_by
            ) VALUES (
              v_candidate_id,
              v_course_id,
              v_course_run_id,
              CURRENT_DATE,
              'enrolled',
              v_admin_user_id
            );
            
            RAISE NOTICE 'Enrolled candidate % in course run %', v_candidate_id, v_course_run_id;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;