# Personal Video Portfolio

Landing page portofolio satu halaman untuk Video Editor & TikTok Content Creator. Antarmuka gelap terinspirasi pengalaman video vertikal, dengan aksen cyan dan pink-red. Galeri hanya menampilkan proyek yang ditandai `published: true`, sehingga placeholder tidak tampil sebagai karya asli.

## Teknologi
- React 18 + TypeScript
- Vite
- CSS responsif
- Lucide React untuk ikon

## Menjalankan proyek
Pastikan Node.js versi LTS terpasang.

```bash
npm install
npm run dev
```

Vite akan menampilkan alamat lokal di terminal.

## Pemeriksaan produksi
```bash
npm run build
npm run preview
```

Hasil build berada di `dist/`.

## Mengubah informasi pribadi
Edit `src/config/siteConfig.ts`. Informasi profil Hafid sudah dimasukkan ke konfigurasi. Perbarui data di file ini jika ada perubahan. Alamat rumah lengkap sengaja tidak ditampilkan pada website publik; cukup tampilkan Klaten, Jawa Tengah demi privasi. URL WhatsApp/TikTok/Instagram/LinkedIn tersedia sebagai konfigurasi untuk pengembangan berikutnya; jangan isi dengan akun yang bukan milik Anda. Perbarui metadata SEO di `index.html` (judul, deskripsi, canonical URL, Open Graph image) sebelum publikasi.

## Menambah karya melalui Admin
1. Salin `.env.example` menjadi `.env.local`.
2. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` menggunakan nilai proyek Supabase Anda yang sudah ada. Jangan membagikan file `.env.local`.
3. Jalankan `npm install` lalu `npm run dev`.
4. Buka `http://localhost:5173/admin` dan login menggunakan akun admin yang sudah dikonfigurasi.
5. Isi detail karya, lalu pilih salah satu sumber: **Upload MP4**, **TikTok**, atau **YouTube**.

### Sumber video
- **Upload MP4:** maksimal 50 MB. Browser membuat file preview yang lebih ringan dan thumbnail sebelum mengunggah aset ke Supabase Storage.
- **TikTok:** gunakan URL video lengkap seperti `https://www.tiktok.com/@username/video/123456789`. Video diputar melalui TikTok Player. Video harus dapat diakses publik; link profil dan link pendek `vm.tiktok.com` belum didukung.
- **YouTube:** gunakan URL video biasa, Shorts, atau `youtu.be`. Atur visibilitas video menjadi **Unlisted / Tidak Publik**, bukan **Private**. Unlisted tidak muncul di pencarian publik, tetapi siapa pun yang memiliki link dapat menonton dan menyematkannya di portofolio.

Link TikTok dan YouTube disimpan sebagai referensi di kolom `file_path` dengan penanda internal `external:`. Dengan demikian, penambahan link tidak mengunggah ulang video ke Supabase Storage dan tidak memerlukan perubahan skema database. Karya lama yang tersimpan sebagai file tetap didukung.

### Performa
- Video YouTube hanya memuat thumbnail pada kartu; pemutar YouTube baru dimuat saat kartu dibuka.
- TikTok menggunakan iframe dengan `loading="lazy"`.
- Video MP4 tidak diunduh sebelum preview diperlukan, dan preview yang diproses lebih kecil daripada file sumber.

### Catatan akses
Pengunjung harus dapat mengakses video eksternal. Video yang dihapus, dibatasi wilayah/usia, atau dinonaktifkan pemiliknya mungkin tidak dapat diputar meskipun link tersimpan. Untuk video YouTube Unlisted, jangan membagikan link jika Anda ingin menjaga akses tetap terbatas.

## Deploy
- **Vercel:** impor repository, gunakan preset Vite, build command `npm run build`, output directory `dist`.
- **Netlify:** build command `npm run build`, publish directory `dist`.
- Hosting statis lain: unggah isi folder `dist/` setelah build sukses.

## Catatan
Email dan domain di konfigurasi merupakan placeholder, bukan kontak sungguhan. Belum ada aset portofolio asli yang disertakan. File media contoh belum tersedia; tambahkan media sendiri sebelum menandai proyek sebagai publik. Google Fonts digunakan untuk Inter dengan fallback sans-serif lokal.


## Custom portfolio order (one-time Supabase setup)

The Admin page supports manual ordering with the up/down arrows. Before using this feature, run the SQL in `SUPABASE_CUSTOM_ORDER.sql` once:

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** and create a new query.
3. Paste the contents of `SUPABASE_CUSTOM_ORDER.sql` and run it.
4. Deploy the updated website and open `/admin`.
5. Use the up/down arrows in **URUTAN PORTOFOLIO**, then click **SIMPAN URUTAN**.

The migration adds only the `display_order` column and an index. Existing video records and Storage files are preserved. Existing videos are initially ordered newest-first to match the previous website behavior. Newly added videos are placed at the end. Ensure the existing Supabase Row Level Security policy permits the authenticated admin account to update rows in `portfolio_videos` (the same admin account already used by this project).
