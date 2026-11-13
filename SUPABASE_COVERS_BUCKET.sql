-- ============================================================================
-- SETUP BUCKET PUBLIK: portfolio-covers
-- Menyimpan gambar cover TikTok/video secara permanen di Supabase Storage
-- ============================================================================

-- 1. Buat bucket publik 'portfolio-covers' (idempoten)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'portfolio-covers',
  'portfolio-covers',
  true,
  2097152, -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

-- 2. Kebijakan Akses: Siapa saja dapat melihat/mengunduh cover (Publik)
DROP POLICY IF EXISTS "Public Access to portfolio-covers" ON storage.objects;
CREATE POLICY "Public Access to portfolio-covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio-covers');

-- 3. Kebijakan Akses: Upload cover baru (Publik / Anon & Admin)
DROP POLICY IF EXISTS "Admin Upload to portfolio-covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload to portfolio-covers" ON storage.objects;
CREATE POLICY "Allow Upload to portfolio-covers"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'portfolio-covers');

-- 4. Kebijakan Akses: Perbarui cover
DROP POLICY IF EXISTS "Admin Update portfolio-covers" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update portfolio-covers" ON storage.objects;
CREATE POLICY "Allow Update portfolio-covers"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'portfolio-covers');

-- 5. Kebijakan Akses: Hapus cover (Admin)
DROP POLICY IF EXISTS "Admin Delete from portfolio-covers" ON storage.objects;
CREATE POLICY "Admin Delete from portfolio-covers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portfolio-covers'
  AND auth.uid() = 'a9009276-3516-466c-8a56-43ddb2d9b04a'
);
