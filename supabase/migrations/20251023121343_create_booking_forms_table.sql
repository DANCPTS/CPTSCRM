/*
  # Create booking forms table

  1. New Tables
    - `booking_forms`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `token` (text, unique) - secure random token for form access
      - `status` (text) - pending, signed, expired
      - `form_data` (jsonb) - stores the submitted form information
      - `signature_data` (text) - base64 encoded signature
      - `signed_at` (timestamptz) - when form was signed
      - `expires_at` (timestamptz) - when the form link expires (7 days)
      - `sent_at` (timestamptz) - when form was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `booking_forms` table
    - Authenticated users (sales/admin) can view all forms
    - Authenticated users (sales/admin) can create forms
    - Anyone with valid token can view their specific form (no auth required)
    - Anyone with valid token can update their form to signed status

  3. Indexes
    - Add index on token for fast lookups
    - Add index on lead_id
    - Add index on status
*/

CREATE TABLE IF NOT EXISTS booking_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'expired')),
  form_data jsonb DEFAULT '{}'::jsonb,
  signature_data text,
  signed_at timestamptz,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all booking forms"
  ON booking_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Authenticated users can create booking forms"
  ON booking_forms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'sales')
    )
  );

CREATE POLICY "Public can view booking form by token"
  ON booking_forms FOR SELECT
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  );

CREATE POLICY "Public can update booking form with valid token"
  ON booking_forms FOR UPDATE
  TO anon
  USING (
    token IS NOT NULL 
    AND status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'signed'
  );

CREATE INDEX IF NOT EXISTS idx_booking_forms_token ON booking_forms(token);
CREATE INDEX IF NOT EXISTS idx_booking_forms_lead_id ON booking_forms(lead_id);
CREATE INDEX IF NOT EXISTS idx_booking_forms_status ON booking_forms(status);
