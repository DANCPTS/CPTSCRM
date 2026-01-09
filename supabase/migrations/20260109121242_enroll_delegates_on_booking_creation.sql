/*
  # Auto-enroll booking form delegates when booking is created

  1. Changes
    - Creates trigger to auto-enroll delegates from booking form when a booking is created
    - When a booking is inserted with a lead_id, finds the booking form delegates
    - Creates candidates if they don't exist
    - Enrolls them in the course run

  2. Flow
    - Booking created for a lead -> Look up booking form delegates -> Create/find candidates -> Enroll in course run
*/

CREATE OR REPLACE FUNCTION enroll_delegates_on_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_booking_form_id uuid;
  v_delegate record;
  v_first_name text;
  v_last_name text;
  v_name_parts text[];
  v_candidate_id uuid;
  v_course_id uuid;
  v_admin_user_id uuid;
BEGIN
  IF NEW.lead_id IS NULL OR NEW.course_run_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;

  SELECT course_id INTO v_course_id FROM course_runs WHERE id = NEW.course_run_id;

  SELECT id INTO v_booking_form_id
  FROM booking_forms
  WHERE lead_id = NEW.lead_id
    AND status = 'signed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_booking_form_id IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_delegate IN
    SELECT 
      bfd.name,
      bfd.email,
      bfd.phone,
      bfd.national_insurance,
      bfd.date_of_birth,
      bfd.address,
      bfd.postcode,
      bfd.city,
      bfd.citb_hse_number,
      bfd.cpcs_card_number,
      bfd.npors_card_number
    FROM booking_form_delegates bfd
    WHERE bfd.booking_form_id = v_booking_form_id
  LOOP
    IF v_delegate.name IS NULL OR trim(v_delegate.name) = '' THEN
      CONTINUE;
    END IF;

    v_name_parts := string_to_array(trim(v_delegate.name), ' ');

    IF array_length(v_name_parts, 1) >= 2 THEN
      v_first_name := v_name_parts[1];
      v_last_name := array_to_string(v_name_parts[2:array_length(v_name_parts, 1)], ' ');
    ELSE
      v_first_name := trim(v_delegate.name);
      v_last_name := '';
    END IF;

    SELECT id INTO v_candidate_id
    FROM candidates
    WHERE lower(first_name) = lower(v_first_name)
      AND lower(last_name) = lower(v_last_name)
    LIMIT 1;

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
        NULLIF(trim(v_delegate.email), ''),
        NULLIF(trim(v_delegate.phone), ''),
        NULLIF(trim(v_delegate.national_insurance), ''),
        CASE WHEN v_delegate.date_of_birth IS NOT NULL AND v_delegate.date_of_birth != '' THEN v_delegate.date_of_birth::date ELSE NULL END,
        NULLIF(trim(v_delegate.address), ''),
        NULLIF(trim(v_delegate.city), ''),
        NULLIF(trim(v_delegate.postcode), ''),
        NULLIF(trim(v_delegate.citb_hse_number), ''),
        NULLIF(trim(v_delegate.cpcs_card_number), ''),
        NULLIF(trim(v_delegate.npors_card_number), ''),
        'active',
        v_admin_user_id
      )
      RETURNING id INTO v_candidate_id;

      RAISE NOTICE 'Created candidate: % % (ID: %)', v_first_name, v_last_name, v_candidate_id;
    END IF;

    IF v_candidate_id IS NOT NULL AND v_course_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM candidate_courses
        WHERE candidate_id = v_candidate_id
          AND course_run_id = NEW.course_run_id
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
          NEW.course_run_id,
          CURRENT_DATE,
          'enrolled',
          v_admin_user_id
        );

        RAISE NOTICE 'Enrolled candidate % in course run %', v_candidate_id, NEW.course_run_id;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enroll_delegates_on_booking_insert_trigger ON bookings;

CREATE TRIGGER enroll_delegates_on_booking_insert_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION enroll_delegates_on_booking_insert();
