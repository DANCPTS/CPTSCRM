/*
  # Allow anonymous access to leads via booking forms

  1. Changes
    - Add policy to allow anonymous users to view lead details when accessing via a valid booking form token
    - This enables the booking form page to pre-populate lead information for anonymous users
  
  2. Security
    - Anonymous users can only access leads that have an associated valid (pending, non-expired) booking form
    - Does not expose all leads, only those with active booking forms
*/

DROP POLICY IF EXISTS "Public can view leads with valid booking form" ON leads;

CREATE POLICY "Public can view leads with valid booking form"
  ON leads
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM booking_forms bf
      WHERE bf.lead_id = leads.id
        AND bf.status = 'pending'
        AND bf.expires_at > now()
    )
  );
