/*
  # Fix invoice reminder to use correct column names

  1. Changes
    - Update trigger to use reference_id and reference_type instead of related_id and related_type
*/

CREATE OR REPLACE FUNCTION create_invoice_reminder_on_booking_signed()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_user_id uuid;
  v_lead_name text;
  v_company_name text;
BEGIN
  -- Only trigger when status changes to 'signed'
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    
    -- Get the lead information and assigned user
    SELECT l.assigned_to, l.name, l.company_name
    INTO v_assigned_user_id, v_lead_name, v_company_name
    FROM leads l
    WHERE l.id = NEW.lead_id;
    
    -- If no assigned user, get first admin
    IF v_assigned_user_id IS NULL THEN
      SELECT id INTO v_assigned_user_id 
      FROM users 
      WHERE role = 'admin' 
      LIMIT 1;
    END IF;
    
    -- Create the invoice reminder notification
    IF v_assigned_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        read,
        created_at
      ) VALUES (
        v_assigned_user_id,
        'invoice_reminder',
        'Send Invoice',
        CASE 
          WHEN v_company_name IS NOT NULL THEN 
            'Booking form signed by ' || v_lead_name || ' (' || v_company_name || '). Remember to send an invoice.'
          ELSE 
            'Booking form signed by ' || v_lead_name || '. Remember to send an invoice.'
        END,
        'lead',
        NEW.lead_id,
        false,
        now()
      );
      
      RAISE NOTICE 'Created invoice reminder for user % for lead %', v_assigned_user_id, NEW.lead_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
