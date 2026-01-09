/*
  # Update Company Address from Booking Form

  1. Changes
    - Updates `auto_create_contact_from_booking_form()` function to also:
      - Update company address, city, postcode, vat_no, registration_no from booking form
      - Only updates empty/null fields to avoid overwriting existing data

  2. Data Mapping from form_data
    - address -> companies.address
    - city -> companies.city
    - postcode -> companies.postcode
    - vat_no -> companies.vat_no
    - registration_no -> companies.registration_no

  3. Notes
    - Uses COALESCE to only update fields if they are currently empty
    - Preserves existing company data
*/

CREATE OR REPLACE FUNCTION auto_create_contact_from_booking_form()
RETURNS TRIGGER AS $$
DECLARE
  v_contact_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_contact_email TEXT;
  v_contact_phone TEXT;
  v_company_id UUID;
  v_existing_contact_id UUID;
  v_name_parts TEXT[];
  v_address TEXT;
  v_city TEXT;
  v_postcode TEXT;
  v_vat_no TEXT;
  v_registration_no TEXT;
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    v_contact_name := NEW.form_data->>'contact_name';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    v_address := NEW.form_data->>'address';
    v_city := NEW.form_data->>'city';
    v_postcode := NEW.form_data->>'postcode';
    v_vat_no := NEW.form_data->>'vat_no';
    v_registration_no := NEW.form_data->>'registration_no';
    
    SELECT company_id INTO v_company_id
    FROM leads
    WHERE id = NEW.lead_id;
    
    IF v_company_id IS NOT NULL THEN
      UPDATE companies
      SET
        address = COALESCE(NULLIF(companies.address, ''), NULLIF(v_address, '')),
        city = COALESCE(NULLIF(companies.city, ''), NULLIF(v_city, '')),
        postcode = COALESCE(NULLIF(companies.postcode, ''), NULLIF(v_postcode, '')),
        vat_no = COALESCE(NULLIF(companies.vat_no, ''), NULLIF(v_vat_no, '')),
        registration_no = COALESCE(NULLIF(companies.registration_no, ''), NULLIF(v_registration_no, '')),
        updated_at = NOW()
      WHERE id = v_company_id;
    END IF;
    
    IF v_contact_name IS NOT NULL AND v_company_id IS NOT NULL THEN
      v_name_parts := string_to_array(trim(v_contact_name), ' ');
      
      IF array_length(v_name_parts, 1) >= 2 THEN
        v_first_name := v_name_parts[1];
        v_last_name := array_to_string(v_name_parts[2:], ' ');
      ELSE
        v_first_name := v_contact_name;
        v_last_name := '';
      END IF;
      
      SELECT id INTO v_existing_contact_id
      FROM contacts
      WHERE company_id = v_company_id
        AND (
          (email IS NOT NULL AND email = v_contact_email)
          OR (email IS NULL AND first_name = v_first_name AND last_name = v_last_name)
        )
      LIMIT 1;
      
      IF v_existing_contact_id IS NULL THEN
        INSERT INTO contacts (
          id,
          first_name,
          last_name,
          email,
          phone,
          company_id,
          gdpr_consent,
          gdpr_consent_date,
          notes,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          v_first_name,
          v_last_name,
          NULLIF(v_contact_email, ''),
          NULLIF(v_contact_phone, ''),
          v_company_id,
          true,
          NOW(),
          'Auto-created from booking form',
          NOW(),
          NOW()
        );
      ELSE
        UPDATE contacts
        SET
          phone = COALESCE(NULLIF(v_contact_phone, ''), phone),
          email = COALESCE(NULLIF(v_contact_email, ''), email),
          updated_at = NOW()
        WHERE id = v_existing_contact_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
