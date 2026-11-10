# Konteks untuk Pengembangan Berbantuan AI

## Tujuan
Membuat portofolio profesional satu halaman untuk video editing dan short-form content creation (TikTok, Reels, Shorts). Membantu recruiter, brand, bisnis, dan agensi menilai karya dengan cepat serta menemukan jalur kontak.

## Arsitektur & Teknologi
- React 18 + TypeScript + Vite.
- Supabase: Database (`portfolio_videos`), Storage privat (`portfolio-videos` untuk upload MP4 mentah & preview), dan Storage publik (`portfolio-covers` untuk cover TikTok permanen).
- Vercel: Hosting SPA dengan serverless cover proxy (`api/tiktok-thumb.js`).
- State & Komponen:
  - `src/components/VideoFeed.tsx`: Grid 3 kolom (laptop & mobile) dengan pembatasan 9 video utama awal (`TOP 9`) dan tombol ekspansi.
  - `src/components/VideoItem.tsx`: Pure image cover di layer dasar (tanpa live iframe di mobile/touch). Layer live player desktop dimount setelah hover-intent 250ms.
  - `src/components/VideoModal.tsx`: Mode preview scroll vertikal satu arah (atas-bawah) dengan debounced `settledIndex` ~160ms, video player aktif hanya pada slide saat ini, YouTube mute/unmute via postMessage tanpa reload src, dan layout informasi teks bersih di luar video.
  - `src/admin/AdminPanel.tsx`: CMS manajemen video dengan fitur upload MP4, simpan link eksternal, edit karya (judul/klien/deskripsi/cover), custom sorting (1-9), dan auto-persist cover TikTok ke Supabase Storage.
