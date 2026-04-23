/*
  # Sync booking_reference from lead to booking_forms

  1. Changes
    - Adds a trigger so that whenever a booking_form is inserted or updated,
      if its booking_reference is null, it is populated from the associated lead's booking_reference.
    - Ensures downloaded booking form PDFs always display the booking form number (e.g. DP00002).

  2. Security
    - No RLS changes. This is a data-integrity trigger only.
*/

CREATE OR REPLACE FUNCTION sync_booking_form_reference_from_lead()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_reference IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT booking_reference INTO NEW.booking_reference
    FROM leads
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_form_reference ON booking_forms;

CREATE TRIGGER trg_sync_booking_form_reference
BEFORE INSERT OR UPDATE ON booking_forms
FOR EACH ROW
EXECUTE FUNCTION sync_booking_form_reference_from_lead();
