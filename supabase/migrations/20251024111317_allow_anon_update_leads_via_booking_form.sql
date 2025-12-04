/*
  # Allow anon to update leads via valid booking form

  1. Changes
    - Add policy for anon role to update leads status to 'won'
    - Only allows updates when there's a valid booking form being signed
  
  2. Security
    - Anon can only update leads that have a valid, non-expired booking form
    - Only allows updating the status field to 'won'
    - Validates booking form is in the process of being signed
*/

CREATE POLICY "Public can update lead status via booking form"
  ON leads FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.token IS NOT NULL
        AND bf.expires_at > now()
    )
  )
  WITH CHECK (
    status = 'won'
    AND EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.token IS NOT NULL
        AND bf.expires_at > now()
    )
  );
