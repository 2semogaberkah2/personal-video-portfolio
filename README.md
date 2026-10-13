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

## Menambah karya video dengan link TikTok
1. Jalankan `npm install` lalu `npm run dev`.
2. Buka `http://localhost:5173/admin`.
3. Isi judul, brand, kategori, kontribusi, dan deskripsi.
4. Masukkan URL video TikTok lengkap, misalnya `https://www.tiktok.com/@username/video/123456789`. Link profil dan link pendek `vm.tiktok.com` belum didukung.
5. Klik **Simpan Link TikTok**. Video diputar melalui pemutar resmi TikTok saat kartu dibuka.

Tidak ada file video yang diunggah ke website. Video harus publik dan masih tersedia di TikTok agar pemutar bisa bekerja. Daftar proyek yang dibuat melalui halaman admin versi ini tersimpan di `localStorage` browser, jadi hanya tersedia di browser/perangkat yang menambahkannya. Ini cocok untuk demo, tetapi tidak akan otomatis muncul untuk pengunjung lain pada hosting statis.

### Menampilkan proyek ke semua pengunjung dengan hosting statis gratis
Untuk versi tanpa database, tambahkan objek proyek di `src/data/projects.ts`, isi `tiktokUrl`, `tiktokVideoId` (ID angka setelah `/video/`), judul dan detail, lalu set `published: true`. Jalankan `npm run build` dan deploy ulang folder `dist/`. Jika ingin menambah dan menerbitkan link lewat admin tanpa deploy ulang, hubungkan admin ke database online serta autentikasi.

## Deploy
- **Vercel:** impor repository, gunakan preset Vite, build command `npm run build`, output directory `dist`.
- **Netlify:** build command `npm run build`, publish directory `dist`.
- Hosting statis lain: unggah isi folder `dist/` setelah build sukses.

## Catatan
Email dan domain di konfigurasi merupakan placeholder, bukan kontak sungguhan. Belum ada aset portofolio asli yang disertakan. File media contoh belum tersedia; tambahkan media sendiri sebelum menandai proyek sebagai publik. Google Fonts digunakan untuk Inter dengan fallback sans-serif lokal.

