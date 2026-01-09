/*
  # Auto-create Contact from Booking Form

  1. New Function
    - `auto_create_contact_from_booking_form()` - Creates a contact when a booking form is signed
    - Extracts contact details from form_data JSON
    - Links contact to company via lead's company_id
    - Prevents duplicates by checking email within the same company

  2. Trigger
    - Fires after booking_forms update when status changes to 'signed'
    - Creates contact with: first_name, last_name, email, phone, company_id

  3. Data Mapping
    - contact_name is split into first_name and last_name
    - contact_email -> email
    - contact_phone -> phone
    - Sets GDPR consent to true (they agreed to terms)
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
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    v_contact_name := NEW.form_data->>'contact_name';
    v_contact_email := NEW.form_data->>'contact_email';
    v_contact_phone := NEW.form_data->>'contact_phone';
    
    SELECT company_id INTO v_company_id
    FROM leads
    WHERE id = NEW.lead_id;
    
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

DROP TRIGGER IF EXISTS auto_create_contact_on_booking_signed ON booking_forms;

CREATE TRIGGER auto_create_contact_on_booking_signed
  AFTER UPDATE ON booking_forms
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_contact_from_booking_form();