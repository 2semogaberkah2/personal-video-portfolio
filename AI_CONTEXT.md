# Konteks untuk Pengembangan Berbantuan AI

## Tujuan
Membuat portofolio profesional satu halaman untuk video editing dan short-form content creation. Tujuan utama adalah membantu recruiter, brand, bisnis, dan agensi menilai karya dengan cepat serta menemukan jalur kontak.

## Audiens
- Brand yang membutuhkan TikTok creator.
- Bisnis yang membutuhkan video promosi pendek.
- Recruiter video editor.
- Agensi social media/digital marketing.
- UMKM dengan kebutuhan produk, kuliner, lifestyle, atau konten promosi.

## Prinsip desain
- Karya harus menjadi fokus utama; jangan menambah hero besar atau biografi panjang.
- Latar hitam, teks putih, cyan `#25F4EE` secukupnya, pink-red `#FE2C55` untuk CTA.
- Inspirasi TikTok sebatas pola konten vertikal dan bahasa visual; jangan meniru logo/menyiratkan afiliasi resmi.
- Jangan menampilkan statistik, testimoni, nama klien, tanggal, atau hasil yang tidak terverifikasi.
- Placeholder tidak boleh disajikan sebagai karya nyata.

## Arsitektur
- `src/config/siteConfig.ts`: identitas dan kontak.
- `src/data/projects.ts`: daftar proyek, urutan, path media, dan status publikasi.
- `src/data/experience.ts`: pengalaman yang tersedia.
- `src/components/`: bagian UI terpisah.
- `src/styles/`: CSS global dan layout.
- `public/assets/`: media lokal.

## Keputusan teknis
- React + TypeScript + Vite, tanpa backend/database/auth.
- Galeri mengabaikan proyek yang `published` bukan `true`.
- Video preview dimuat dengan `preload="none"`, muted, loop, dan inline. Video penuh dimuat saat modal dibuka.
- Modal menyediakan tombol tutup, Escape, penguncian scroll, dan pemulihan fokus.
- Desain menggunakan grid responsif dan dukungan reduced-motion.

## Pedoman perubahan selanjutnya
1. Pertahankan satu halaman dan fokus video.
2. Jangan membuat klaim performa atau menambahkan karya tanpa data dari pemilik.
3. Jangan menambahkan library besar tanpa alasan jelas.
4. Pastikan tombol dan tautan berfungsi serta aksesibel.
5. Update dokumentasi bila struktur atau perilaku berubah.
6. Jalankan `npm run build` setelah perubahan TypeScript/CSS bila memungkinkan.
