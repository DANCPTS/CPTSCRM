/*
  # Link Existing Bookings to Candidates (Fixed with created_by)

  1. Purpose
    - Find existing bookings that match candidates by email, phone, or name
    - Update those bookings with the correct candidate_id
    - Enroll candidates in their courses with proper created_by field

  2. Matching Logic
    - First tries to match by email (most reliable)
    - Then tries to match by phone
    - Finally tries to match by first name + last name combination
    - Only matches where company_id is NULL (individual bookings)

  3. Process
    - Updates bookings table with candidate_id where matches found
    - Creates candidate_courses enrollments with proper created_by
*/

-- Link bookings to candidates based on matching contact information
DO $$
DECLARE
  v_booking RECORD;
  v_candidate_id uuid;
  v_contact RECORD;
  v_course_id uuid;
  v_enrolled_count integer := 0;
  v_created_by uuid;
BEGIN
  -- Get a user ID to use as created_by
  SELECT id INTO v_created_by FROM users LIMIT 1;

  -- Loop through all bookings that don't have a candidate_id and have no company (individual bookings)
  FOR v_booking IN
    SELECT b.id, b.contact_id, b.course_run_id
    FROM bookings b
    WHERE b.candidate_id IS NULL
    AND b.company_id IS NULL
  LOOP
    -- Get contact info
    SELECT * INTO v_contact
    FROM contacts
    WHERE id = v_booking.contact_id;

    IF v_contact IS NOT NULL THEN
      v_candidate_id := NULL;

      -- Try to match by email (most reliable)
      IF v_contact.email IS NOT NULL AND v_contact.email != '' THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE LOWER(email) = LOWER(v_contact.email)
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If no match by email, try by phone
      IF v_candidate_id IS NULL AND v_contact.phone IS NOT NULL AND v_contact.phone != '' THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE phone = v_contact.phone
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If no match by phone, try by name combination
      IF v_candidate_id IS NULL AND v_contact.first_name IS NOT NULL AND v_contact.last_name IS NOT NULL THEN
        SELECT id INTO v_candidate_id
        FROM candidates
        WHERE LOWER(first_name) = LOWER(v_contact.first_name)
        AND LOWER(last_name) = LOWER(v_contact.last_name)
        AND status = 'active'
        LIMIT 1;
      END IF;

      -- If we found a matching candidate, update the booking and enroll them
      IF v_candidate_id IS NOT NULL THEN
        -- Update the booking with candidate_id
        UPDATE bookings
        SET candidate_id = v_candidate_id
        WHERE id = v_booking.id;

        -- Get the course_id from course_run
        SELECT course_id INTO v_course_id
        FROM course_runs
        WHERE id = v_booking.course_run_id;

        -- Enroll the candidate if not already enrolled
        IF v_course_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM candidate_courses
            WHERE candidate_id = v_candidate_id
            AND course_id = v_course_id
            AND course_run_id = v_booking.course_run_id
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
              v_booking.course_run_id,
              NOW(),
              'enrolled',
              v_created_by
            );

            v_enrolled_count := v_enrolled_count + 1;
            RAISE NOTICE 'Linked and enrolled candidate % in course % (booking: %)', v_candidate_id, v_course_id, v_booking.id;
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration complete: Linked and enrolled % candidates from existing bookings', v_enrolled_count;
END $$;
