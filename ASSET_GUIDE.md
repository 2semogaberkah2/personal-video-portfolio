# Panduan Aset

## Struktur folder
- `public/assets/images/thumbnails/`: poster proyek.
- `public/assets/images/profile/`: foto profil jika kelak diperlukan.
- `public/assets/images/branding/`: favicon dan gambar share.
- `public/assets/videos/previews/`: klip hover ringan.
- `public/assets/videos/full/`: video untuk modal.
- `public/assets/documents/`: dokumen publik yang relevan.

## Format dan ukuran yang disarankan
- Thumbnail: WebP atau JPEG; gunakan frame 9:16, disarankan 720 × 1280 px atau lebih tinggi sesuai kebutuhan.
- Video: MP4 H.264 dengan audio AAC untuk kompatibilitas luas; WebM dapat ditambahkan jika implementasi diperluas.
- Preview hover: potongan pendek, terkompresi, tanpa audio, dengan resolusi/bitrate lebih rendah daripada video penuh.
- Full video: simpan versi yang cukup jernih tetapi tetap ramah bandwidth.

## Penamaan dan pengaitan
Gunakan nama huruf kecil, angka, dan tanda hubung, misalnya `kedai-menu-short.webp`, `kedai-menu-preview.mp4`, `kedai-menu-full.mp4`. Cantumkan path absolut dari root situs dalam `src/data/projects.ts`, misalnya `/assets/videos/previews/kedai-menu-preview.mp4`.

## Troubleshooting
- Jika thumbnail rusak, pastikan file benar-benar berada di folder yang sesuai dan kapitalisasi nama cocok.
- Jika video tidak bisa diputar, coba MP4 H.264, periksa file, dan pastikan path benar.
- Jika preview autoplay diblokir browser, poster tetap harus dapat diklik.
- Jangan set `published: true` sebelum aset dan informasi proyek siap.
