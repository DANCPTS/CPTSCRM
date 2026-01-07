/*
  # Update auto-create candidates trigger to include card numbers

  1. Changes
    - Extract citb_hse_number, cpcs_card_number, npors_card_number from booking form delegates
    - Populate these fields when creating new candidates
    - Update existing candidates with card numbers if provided

  2. Notes
    - These fields are populated from the booking form delegate details
    - All card number fields are optional
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
  v_delegate_email text;
  v_delegate_phone text;
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
  v_city text;
  v_citb_hse_number text;
  v_cpcs_card_number text;
  v_npors_card_number text;
  v_company_id uuid;
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN

    SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;

    v_contact_name := NEW.form_data->>'contact_name';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_course_name := NEW.form_data->>'course_name';

    IF NEW.lead_id IS NOT NULL THEN
      SELECT company_id INTO v_company_id
      FROM leads
      WHERE id = NEW.lead_id
      LIMIT 1;
    END IF;

    IF v_contact_name IS NOT NULL AND trim(v_contact_name) != '' THEN
      v_name_parts := string_to_array(trim(v_contact_name), ' ');

      IF array_length(v_name_parts, 1) >= 2 THEN
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
      ELSE
        v_first_name := trim(v_contact_name);
        v_last_name := '';
      END IF;

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

    IF v_course_name IS NOT NULL THEN
      SELECT id INTO v_course_id FROM courses WHERE title ILIKE '%' || v_course_name || '%' LIMIT 1;
    END IF;

    IF NEW.lead_id IS NOT NULL THEN
      SELECT b.course_run_id INTO v_course_run_id
      FROM bookings b
      WHERE b.lead_id = NEW.lead_id
        AND b.course_run_id IS NOT NULL
      ORDER BY b.created_at DESC
      LIMIT 1;
    END IF;

    IF v_course_run_id IS NULL AND v_course_id IS NOT NULL THEN
      SELECT id INTO v_course_run_id
      FROM course_runs
      WHERE course_id = v_course_id
        AND start_date >= CURRENT_DATE
      ORDER BY start_date ASC
      LIMIT 1;
    END IF;

    IF NEW.form_data->'delegates' IS NOT NULL THEN
      FOR v_delegate IN SELECT * FROM jsonb_array_elements(NEW.form_data->'delegates')
      LOOP
        v_delegate_name := v_delegate->>'name';
        v_delegate_email := v_delegate->>'email';
        v_delegate_phone := v_delegate->>'phone';
        v_ni_number := v_delegate->>'national_insurance';
        v_dob := v_delegate->>'date_of_birth';
        v_address := v_delegate->>'address';
        v_postcode := v_delegate->>'postcode';
        v_city := v_delegate->>'city';
        v_citb_hse_number := v_delegate->>'citb_hse_number';
        v_cpcs_card_number := v_delegate->>'cpcs_card_number';
        v_npors_card_number := v_delegate->>'npors_card_number';

        IF v_delegate_name IS NULL OR trim(v_delegate_name) = '' THEN
          CONTINUE;
        END IF;

        v_delegate_name := trim(v_delegate_name);

        v_name_parts := string_to_array(v_delegate_name, ' ');

        IF array_length(v_name_parts, 1) >= 2 THEN
          v_first_name := v_name_parts[1];
          v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
        ELSE
          v_first_name := v_delegate_name;
          v_last_name := '';
        END IF;

        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE lower(first_name) = lower(v_first_name)
          AND lower(last_name) = lower(v_last_name)
        LIMIT 1;

        v_delegate_email := COALESCE(NULLIF(trim(v_delegate_email), ''), v_contact_email);
        v_delegate_phone := COALESCE(NULLIF(trim(v_delegate_phone), ''), v_contact_phone);

        IF v_candidate_id IS NULL THEN
          INSERT INTO candidates (
            first_name,
            last_name,
            email,
            phone,
            national_insurance_number,
            date_of_birth,
            address,
            city,
            postcode,
            citb_hse_number,
            cpcs_card_number,
            npors_card_number,
            status,
            created_by
          ) VALUES (
            v_first_name,
            v_last_name,
            v_delegate_email,
            v_delegate_phone,
            v_ni_number,
            CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE NULL END,
            v_address,
            v_city,
            v_postcode,
            NULLIF(trim(v_citb_hse_number), ''),
            NULLIF(trim(v_cpcs_card_number), ''),
            NULLIF(trim(v_npors_card_number), ''),
            'active',
            v_admin_user_id
          )
          RETURNING id INTO v_candidate_id;

          RAISE NOTICE 'Created candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        ELSE
          UPDATE candidates
          SET
            email = COALESCE(v_delegate_email, email),
            phone = COALESCE(v_delegate_phone, phone),
            national_insurance_number = COALESCE(v_ni_number, national_insurance_number),
            date_of_birth = CASE WHEN v_dob IS NOT NULL AND v_dob != '' THEN v_dob::date ELSE date_of_birth END,
            address = COALESCE(v_address, address),
            city = COALESCE(v_city, city),
            postcode = COALESCE(v_postcode, postcode),
            citb_hse_number = COALESCE(NULLIF(trim(v_citb_hse_number), ''), citb_hse_number),
            cpcs_card_number = COALESCE(NULLIF(trim(v_cpcs_card_number), ''), cpcs_card_number),
            npors_card_number = COALESCE(NULLIF(trim(v_npors_card_number), ''), npors_card_number),
            updated_at = now()
          WHERE id = v_candidate_id;

          RAISE NOTICE 'Updated candidate (delegate): % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
        END IF;

        IF v_candidate_id IS NOT NULL AND v_course_run_id IS NOT NULL THEN
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
