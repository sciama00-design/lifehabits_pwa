-- ==========================================
-- STORAGE SETUP FOR MEDIA BUCKET
-- ==========================================

-- 1. Create the 'media' bucket if it doesn't exist
-- Note: inserting into storage.buckets if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
SELECT 'media', 'media', true
WHERE NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'media'
);

-- 2. Set up RLS Policies for the 'media' bucket

-- A. Allow Public Read Access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'media' );

-- B. Allow Authenticated Users (Coaches) to Upload
-- Assuming 'coach' role is handled via profiles table check in actual app logic, 
-- but here we simplified to any authenticated user for the bucket.
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'media' );

-- C. Allow Authenticated Users to Update/Delete their own files
-- (In this simple version, we allow any authenticated user to manage media objects, 
-- as coaches share the library. For stricter control, owner checks would be needed).
CREATE POLICY "Authenticated Manage"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'media' );
