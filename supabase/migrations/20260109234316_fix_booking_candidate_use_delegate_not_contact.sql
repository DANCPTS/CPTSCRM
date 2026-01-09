/*
  # Fix booking candidate assignment to use delegates not booker/contact

  1. Problem
    - When bookings are created from leads with booking forms, the contact (booker) 
      was being assigned as the candidate instead of the actual delegates
    - This caused the booker to appear on joining instructions and calendar enrollments

  2. Solution
    - Update the enroll_delegates_on_booking_insert trigger to also set the 
      booking's candidate_id to the first delegate for that course
    - Only does this if the booking was created without a candidate or with the wrong candidate

  3. Changes
    - Modifies enroll_delegates_on_booking_insert function to update booking.candidate_id
*/

CREATE OR REPLACE FUNCTION enroll_delegates_on_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_booking_form_id uuid;
  v_booking_form_course_id uuid;
  v_delegate record;
  v_first_name text;
  v_last_name text;
  v_name_parts text[];
  v_candidate_id uuid;
  v_first_delegate_candidate_id uuid;
  v_course_id uuid;
  v_course_title text;
  v_admin_user_id uuid;
  v_contact_id uuid;
  v_contact_candidate_id uuid;
BEGIN
  IF NEW.lead_id IS NULL OR NEW.course_run_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_admin_user_id FROM users WHERE role = 'admin' LIMIT 1;

  SELECT cr.course_id, c.title INTO v_course_id, v_course_title
  FROM course_runs cr
  JOIN courses c ON c.id = cr.course_id
  WHERE cr.id = NEW.course_run_id;

  SELECT id INTO v_booking_form_id
  FROM booking_forms
  WHERE lead_id = NEW.lead_id
    AND status = 'signed'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_booking_form_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_booking_form_course_id
  FROM booking_form_courses
  WHERE booking_form_id = v_booking_form_id
    AND course_name ILIKE '%' || v_course_title || '%'
  LIMIT 1;

  IF v_booking_form_course_id IS NULL THEN
    SELECT id INTO v_booking_form_course_id
    FROM booking_form_courses
    WHERE booking_form_id = v_booking_form_id
      AND v_course_title ILIKE '%' || course_name || '%'
    LIMIT 1;
  END IF;

  IF v_booking_form_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_first_delegate_candidate_id := NULL;

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
    JOIN booking_form_delegate_courses bfdc ON bfdc.delegate_id = bfd.id
    WHERE bfdc.course_id = v_booking_form_course_id
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
    WHERE lower(trim(first_name)) = lower(trim(v_first_name))
      AND lower(trim(last_name)) = lower(trim(v_last_name))
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
    END IF;

    IF v_first_delegate_candidate_id IS NULL THEN
      v_first_delegate_candidate_id := v_candidate_id;
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
      END IF;
    END IF;
  END LOOP;

  IF v_first_delegate_candidate_id IS NOT NULL THEN
    IF NEW.contact_id IS NOT NULL THEN
      SELECT ca.id INTO v_contact_candidate_id
      FROM contacts co
      JOIN candidates ca ON lower(trim(ca.first_name)) = lower(trim(co.first_name))
                        AND lower(trim(ca.last_name)) = lower(trim(co.last_name))
      WHERE co.id = NEW.contact_id
      LIMIT 1;
      
      IF NEW.candidate_id IS NULL OR NEW.candidate_id = v_contact_candidate_id THEN
        UPDATE bookings 
        SET candidate_id = v_first_delegate_candidate_id
        WHERE id = NEW.id;
      END IF;
    ELSIF NEW.candidate_id IS NULL THEN
      UPDATE bookings 
      SET candidate_id = v_first_delegate_candidate_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
