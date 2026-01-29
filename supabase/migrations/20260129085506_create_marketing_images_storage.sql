/*
  # Create Marketing Images Storage Bucket

  1. Storage
    - Creates 'marketing-images' bucket for email template images
    - Public access enabled so images can be viewed in emails
  
  2. Security
    - Authenticated users can upload images
    - Anyone can view images (required for email rendering)
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-images', 'marketing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload marketing images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'marketing-images');

CREATE POLICY "Authenticated users can update their marketing images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'marketing-images');

CREATE POLICY "Authenticated users can delete marketing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'marketing-images');

CREATE POLICY "Anyone can view marketing images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'marketing-images');