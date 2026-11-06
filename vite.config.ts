import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tiktok-thumb-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api/tiktok-thumb', async (req, res) => {
          try {
            const reqUrl = new URL(req.url || '', 'http://localhost');
            const url = reqUrl.searchParams.get('url') || '';
            const id = reqUrl.searchParams.get('id') || '';
            const candidates = [
              url,
              id ? `https://www.tiktok.com/@tiktok/video/${id}` : '',
            ].filter(Boolean);

            let thumbnailUrl = '';
            for (const candidate of candidates) {
              const r = await fetch(
                `https://www.tiktok.com/oembed?url=${encodeURIComponent(candidate)}`
              );
              if (r.ok) {
                const data = (await r.json()) as { thumbnail_url?: string };
                if (data?.thumbnail_url) {
                  thumbnailUrl = data.thumbnail_url;
                  break;
                }
              }
            }

            if (!thumbnailUrl) {
              res.statusCode = 404;
              res.end('Thumbnail not found');
              return;
            }

            const imgRes = await fetch(thumbnailUrl, {
              headers: { Referer: 'https://www.tiktok.com/' },
            });
            if (!imgRes.ok) {
              res.statusCode = 302;
              res.setHeader('Location', thumbnailUrl);
              res.end();
              return;
            }

            const buf = Buffer.from(await imgRes.arrayBuffer());
            res.statusCode = 200;
            res.setHeader(
              'Content-Type',
              imgRes.headers.get('content-type') || 'image/jpeg'
            );
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.end(buf);
          } catch {
            res.statusCode = 500;
            res.end('Proxy error');
          }
        });
      },
    },
  ],
  // FFmpeg creates its own worker at runtime; do not prebundle its wrapper.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg'],
  },
});
