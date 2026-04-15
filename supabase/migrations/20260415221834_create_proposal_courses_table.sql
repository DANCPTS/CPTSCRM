/*
  # Create proposal_courses table

  1. New Tables
    - `proposal_courses`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `course_name` (text, course title)
      - `price` (numeric, course price)
      - `currency` (text, defaults to GBP)
      - `dates` (text, course dates)
      - `venue` (text, course venue)
      - `number_of_delegates` (integer, delegate count)
      - `notes` (text, optional notes)
      - `display_order` (integer, ordering)
      - `vat_exempt` (boolean, VAT exemption flag)
      - `created_at` (timestamptz)
      - `created_by` (uuid, foreign key to users)

  2. Security
    - Enable RLS on `proposal_courses` table
    - Add policies for authenticated users to perform CRUD operations

  3. Data Migration
    - Migrate existing proposal data from leads table into proposal_courses
*/

CREATE TABLE IF NOT EXISTS proposal_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  dates text,
  venue text,
  number_of_delegates integer NOT NULL DEFAULT 1,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  vat_exempt boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_proposal_courses_lead_id ON proposal_courses(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_courses_display_order ON proposal_courses(lead_id, display_order);

ALTER TABLE proposal_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view proposal courses"
  ON proposal_courses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = proposal_courses.lead_id
      AND (leads.assigned_to = auth.uid() OR leads.created_by = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can insert proposal courses"
  ON proposal_courses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update proposal courses"
  ON proposal_courses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = proposal_courses.lead_id
      AND (leads.assigned_to = auth.uid() OR leads.created_by = auth.uid())
    )
  )
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete proposal courses"
  ON proposal_courses FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = proposal_courses.lead_id
      AND (leads.assigned_to = auth.uid() OR leads.created_by = auth.uid())
    )
  );

INSERT INTO proposal_courses (
  lead_id,
  course_name,
  price,
  currency,
  dates,
  venue,
  number_of_delegates,
  display_order,
  created_at,
  created_by
)
SELECT
  id,
  quoted_course,
  COALESCE(quoted_price, 0),
  COALESCE(quoted_currency, 'GBP'),
  quoted_dates,
  quoted_venue,
  COALESCE(number_of_delegates, 1),
  0,
  created_at,
  created_by
FROM leads
WHERE quoted_course IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM proposal_courses WHERE proposal_courses.lead_id = leads.id
)
ON CONFLICT DO NOTHING;