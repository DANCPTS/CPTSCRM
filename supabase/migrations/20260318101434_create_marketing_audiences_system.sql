/*
  # Create Marketing Audiences System

  1. New Tables
    - `marketing_audiences`
      - `id` (uuid, primary key)
      - `name` (text, required) - audience name
      - `description` (text, nullable) - optional description
      - `audience_type` (text) - one of: individuals, companies, all, upload_only
      - `member_count` (integer, default 0) - cached total members
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `audience_members`
      - `id` (uuid, primary key)
      - `audience_id` (uuid, FK to marketing_audiences, CASCADE DELETE)
      - `email` (text, required)
      - `name` (text, required)
      - `company_name` (text, nullable)
      - `source` (text) - one of: candidate, contact, excel_upload
      - `source_id` (uuid, nullable) - links to candidates.id or contacts.id
      - `subscribed` (boolean, default true) - whether this member is active
      - `unsubscribed_at` (timestamptz, nullable)
      - `added_at` (timestamptz, default now)

  2. Schema Changes
    - Add `audience_id` column to `marketing_campaigns` (nullable FK)

  3. Security
    - Enable RLS on both new tables
    - Policies for authenticated users matching existing marketing table patterns
*/

-- Create marketing_audiences table
CREATE TABLE IF NOT EXISTS marketing_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  audience_type text NOT NULL DEFAULT 'upload_only' CHECK (audience_type IN ('individuals', 'companies', 'all', 'upload_only')),
  member_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE marketing_audiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audiences"
  ON marketing_audiences FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create audiences"
  ON marketing_audiences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update audiences"
  ON marketing_audiences FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creator can delete audiences"
  ON marketing_audiences FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create audience_members table
CREATE TABLE IF NOT EXISTS audience_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_id uuid NOT NULL REFERENCES marketing_audiences(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  company_name text,
  source text NOT NULL DEFAULT 'excel_upload' CHECK (source IN ('candidate', 'contact', 'excel_upload')),
  source_id uuid,
  subscribed boolean NOT NULL DEFAULT true,
  unsubscribed_at timestamptz,
  added_at timestamptz DEFAULT now()
);

ALTER TABLE audience_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audience members"
  ON audience_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert audience members"
  ON audience_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update audience members"
  ON audience_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete audience members"
  ON audience_members FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Unique constraint to prevent duplicate emails within same audience
CREATE UNIQUE INDEX IF NOT EXISTS idx_audience_members_unique_email
  ON audience_members(audience_id, email);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audience_members_audience_id
  ON audience_members(audience_id);

CREATE INDEX IF NOT EXISTS idx_audience_members_email
  ON audience_members(email);

CREATE INDEX IF NOT EXISTS idx_marketing_audiences_created_by
  ON marketing_audiences(created_by);

-- Add audience_id to marketing_campaigns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'marketing_campaigns' AND column_name = 'audience_id'
  ) THEN
    ALTER TABLE marketing_campaigns ADD COLUMN audience_id uuid REFERENCES marketing_audiences(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_audience_id
  ON marketing_campaigns(audience_id);
