# Panduan Desain

## Palet warna
- Black / latar utama: `#000000`
- White / teks utama: `#FFFFFF`
- TikTok Cyan / aksen aktif: `#25F4EE`
- TikTok Pink-Red / CTA: `#FE2C55`
- Latar sekunder: `#121212`
- Surface: `#1C1C1C`
- Border: `#2A2A2A`
- Teks sekunder: `#BDBDBD`
- Teks redup: `#8A8A8A`

Gunakan cyan untuk penekanan terbatas. Pink-red terutama untuk tindakan kontak. Hindari gradien neon dan glow berlebihan; thumbnail asli menjadi sumber warna utama.

## Tipografi
Inter, dengan sans-serif sebagai fallback. Heading tebal dan rapat; metadata kecil memakai huruf kapital dan tracking. Pastikan teks isi tetap nyaman dibaca.

## Layout dan spacing
- Navigasi ringkas dan sticky.
- Hero kompak, galeri segera setelah hero.
- Desktop lebar: 3 kolom; tablet: 2 kolom; mobile: 2 kolom untuk melihat banyak karya sekaligus.
- Video default 9:16, metadata ringkas, tanpa card tebal.
- Pengalaman dan pengantar bersifat sekunder.

## Preview dan modal
- Poster tampil secara default.
- Preview desktop mencoba berjalan saat hover/focus, muted dan loop; pause/reset saat pointer/focus keluar.
- Sumber preview menggunakan `preload="none"`.
- Klik/tap membuka modal player. Modal mendukung Escape, tombol tutup, klik backdrop, body scroll lock, dan focus restoration.
- Jika file tidak ada, modal menampilkan petunjuk; thumbnail gagal menampilkan placeholder.

## Responsif dan aksesibilitas
- Breakpoint utama 900px dan 600px; desain disiapkan untuk lebar 375, 430, 768, 1280, dan 1440px.
- Focus ring terlihat, tombol memiliki label aksesibel, gambar memiliki alt text, dan video modal menggunakan kontrol bawaan.
- Interaksi tidak hanya mengandalkan hover.
- `prefers-reduced-motion` mengurangi animasi/transisi.
- Lakukan pengujian visual manual di browser sebelum deployment.
