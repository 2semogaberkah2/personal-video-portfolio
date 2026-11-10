# Changelog

## Arsitektur Cover Permanen & Mode Scroll Terpadu
- Mengganti seluruh fallback iframe di mobile menjadi pure image cover (tanpa live iframe di grid mobile).
- Menambahkan pipeline persist cover TikTok ke Supabase Storage (`portfolio-covers`) dengan fallback runtime Vercel proxy (`/api/tiktok-thumb`).
- Menambahkan skrip CLI `scripts/backfill-tiktok-covers.cjs` (`npm run backfill:covers`) untuk sinkronisasi cover TikTok ke database Supabase.
- Memperbaiki VideoModal dengan settledIndex tunggal (debounce ~160ms), pemutaran aktif hanya pada slide saat ini, YouTube mute/unmute via postMessage tanpa reload iframe, dan layout teks di luar video.
- Menambahkan fitur edit detail karya (judul, brand, kategori, deskripsi, tautan, cover) di `/admin`.
- Membatasi galeri awal beranda ke 9 video utama dengan tombol ekspansi "Lihat Semua Karya".
