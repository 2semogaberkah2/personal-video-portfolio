import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // FFmpeg creates its own worker at runtime; do not prebundle its wrapper.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg'],
  },
  // This project uses the single-threaded @ffmpeg/core build.
  // COOP/COEP headers are intentionally not enabled: SharedArrayBuffer is not
  // required, and cross-origin isolation can block fonts or third-party assets.
});
