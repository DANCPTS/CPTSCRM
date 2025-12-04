/*
  # Create storage bucket for candidate files

  1. New Storage Bucket
    - `candidate-files` - Private bucket for storing candidate documents
    - Files are organized by candidate_id

  2. Security
    - RLS policies for authenticated users to upload, view, and delete files
    - Files are private by default
    - Only authenticated users can access files
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-files', 'candidate-files', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload candidate files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'candidate-files');

-- Allow authenticated users to view candidate files
CREATE POLICY "Authenticated users can view candidate files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'candidate-files');

-- Allow authenticated users to delete candidate files
CREATE POLICY "Authenticated users can delete candidate files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'candidate-files');

-- Allow authenticated users to update candidate files
CREATE POLICY "Authenticated users can update candidate files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'candidate-files')
WITH CHECK (bucket_id = 'candidate-files');
