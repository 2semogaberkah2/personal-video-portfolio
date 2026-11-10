# Personal Video Portfolio

Landing page portofolio satu halaman untuk Video Editor & TikTok Content Creator. Antarmuka gelap terinspirasi pengalaman video vertikal, dengan aksen cyan `#25F4EE` dan CTA pink-red `#FE2C55`.

## Teknologi
- React 18 + TypeScript
- Vite
- Supabase (Database & Storage)
- Lucide React untuk ikon

## Menjalankan Proyek
```bash
npm install
npm run dev
```

## Setup Storage Cover Video TikTok (Sekali Saja)
Untuk menyimpan cover video TikTok secara permanen di Supabase Storage (sehingga tidak kedaluwarsa dan tidak terblokir di iPhone/Safari):
1. Buka dashboard Supabase > **SQL Editor**.
2. Jalankan isi file `SUPABASE_COVERS_BUCKET.sql` untuk membuat bucket publik `portfolio-covers` dan policy akses admin.
3. Untuk mengisi cover pada video TikTok yang sudah tersimpan sebelumnya, jalankan:
   ```bash
   npm run backfill:covers -- --dry-run
   npm run backfill:covers
   ```

## Menambah Karya melalui Admin (`/admin`)
1. Buka `http://localhost:5173/admin` dan login dengan akun admin Supabase.
2. Tambahkan karya baru dari **Upload MP4**, **TikTok**, atau **YouTube**.
3. Urutan `01` s/d `09` (`TOP 9`) otomatis tampil di galeri utama beranda. Pengunjung dapat menekan tombol **"LIHAT SEMUA KARYA"** untuk membuka video lainnya.
4. Klik tombol pensil pada daftar karya untuk mengedit judul, klien, kategori, deskripsi, atau tautan video kapan saja.

## Deploy ke Vercel
Impor repositori GitHub ke Vercel dengan preset Vite. Konfigurasi `vercel.json` dan API serverless cover proxy (`api/tiktok-thumb.js`) sudah disertakan.
