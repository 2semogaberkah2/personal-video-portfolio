-- Jalankan satu kali di Supabase Dashboard > SQL Editor.
-- Menambahkan urutan manual tanpa menghapus atau mengubah file video yang sudah ada.

ALTER TABLE public.portfolio_videos
ADD COLUMN IF NOT EXISTS display_order integer;

-- Pertahankan susunan yang sekarang: video terbaru tetap berada di urutan pertama.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC, id) - 1 AS position
  FROM public.portfolio_videos
)
UPDATE public.portfolio_videos AS videos
SET display_order = ranked.position
FROM ranked
WHERE videos.id = ranked.id
  AND videos.display_order IS NULL;

CREATE INDEX IF NOT EXISTS portfolio_videos_display_order_idx
ON public.portfolio_videos (published, display_order);

-- Izinkan hanya akun admin yang dipakai aplikasi untuk memperbarui urutan.
-- Kebijakan ini tidak memberi izin update kepada pengunjung umum.
DROP POLICY IF EXISTS "Admin can update portfolio video order" ON public.portfolio_videos;
CREATE POLICY "Admin can update portfolio video order"
ON public.portfolio_videos
FOR UPDATE
TO authenticated
USING (auth.uid() = 'a9009276-3516-466c-8a56-43ddb2d9b04a'::uuid)
WITH CHECK (auth.uid() = 'a9009276-3516-466c-8a56-43ddb2d9b04a'::uuid);
