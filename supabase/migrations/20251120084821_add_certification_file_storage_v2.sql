/*
  # Add Certification File Storage

  ## Changes
  1. Storage
    - Create `trainer_certifications` bucket for storing certification documents
    - Configure RLS policies for secure file access

  2. Database Updates
    - Add `file_url` column to `trainer_certifications` table
    - Add `file_name` column to store original filename

  3. Security
    - Allow authenticated users to upload files
    - Allow authenticated users to view/download files
    - Files are organized by trainer_id/certification_id
*/

-- Add file columns to trainer_certifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_certifications' AND column_name = 'file_url'
  ) THEN
    ALTER TABLE trainer_certifications ADD COLUMN file_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trainer_certifications' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE trainer_certifications ADD COLUMN file_name text;
  END IF;
END $$;

-- Create storage bucket for trainer certifications
INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-certifications', 'trainer-certifications', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update certification files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete certification files" ON storage.objects;

-- Storage policies for trainer certifications bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload certification files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'trainer-certifications');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view certification files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trainer-certifications');

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update certification files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'trainer-certifications')
  WITH CHECK (bucket_id = 'trainer-certifications');

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete certification files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'trainer-certifications');
