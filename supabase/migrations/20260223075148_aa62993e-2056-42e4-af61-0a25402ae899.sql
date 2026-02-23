
-- Add thumbnail_url to ctv_listings
ALTER TABLE public.ctv_listings ADD COLUMN thumbnail_url text;

-- Create storage bucket for CTV listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('ctv-images', 'ctv-images', true);

-- Anyone can view CTV images
CREATE POLICY "Anyone can view CTV images"
ON storage.objects FOR SELECT
USING (bucket_id = 'ctv-images');

-- Authenticated users can upload their own CTV images
CREATE POLICY "Users can upload CTV images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ctv-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own CTV images
CREATE POLICY "Users can update own CTV images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ctv-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own CTV images
CREATE POLICY "Users can delete own CTV images"
ON storage.objects FOR DELETE
USING (bucket_id = 'ctv-images' AND auth.uid()::text = (storage.foldername(name))[1]);
