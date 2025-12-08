/*
  # Create booking form signed trigger and function

  1. Changes
    - Create function to update lead status to 'won' when booking form is signed
    - Create notifications for admin and sales users
    - Create trigger to call this function
  
  2. Security
    - Uses SECURITY DEFINER to bypass RLS when updating leads
*/

-- Function to handle booking form signed event
CREATE OR REPLACE FUNCTION notify_booking_form_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_lead_name text;
  v_lead_company text;
  v_user_record RECORD;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Update lead status to 'won'
    UPDATE leads
    SET status = 'won'
    WHERE id = NEW.lead_id;
    
    -- Get lead details
    SELECT 
      leads.name,
      leads.company_name
    INTO v_lead_name, v_lead_company
    FROM leads
    WHERE leads.id = NEW.lead_id;

    -- Create notification for each admin and sales user
    FOR v_user_record IN 
      SELECT id FROM users WHERE role IN ('admin', 'sales')
    LOOP
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_id,
        reference_type
      ) VALUES (
        v_user_record.id,
        'booking_form_signed',
        'Booking Form Signed',
        CASE 
          WHEN v_lead_company IS NOT NULL AND v_lead_company != '' THEN
            v_lead_company || ' (' || v_lead_name || ') has signed their booking form'
          ELSE
            v_lead_name || ' has signed their booking form'
        END,
        NEW.id,
        'booking_form'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_booking_form_signed ON booking_forms;

CREATE TRIGGER on_booking_form_signed
  AFTER UPDATE ON booking_forms
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_form_signed();
