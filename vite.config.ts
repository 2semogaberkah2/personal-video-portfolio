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
            const id = reqUrl.searchParams.get('id') || '';
            const url = reqUrl.searchParams.get('url') || '';

            if (!id || !/^\d{8,25}$/.test(id.trim())) {
              res.statusCode = 400;
              res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
              res.end('Invalid or missing TikTok ID');
              return;
            }

            const { fetchTikTokCover } = (await server.ssrLoadModule(
              '/server/tiktokCover.js'
            )) as {
              fetchTikTokCover: (
                id: string,
                url?: string
              ) => Promise<{ buffer: Buffer; contentType: string } | null>;
            };

            const result = await fetchTikTokCover(id, url);

            if (!result || !result.buffer) {
              res.statusCode = 404;
              res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
              res.end('Cover not found');
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', result.contentType);
            res.setHeader(
              'Cache-Control',
              'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800'
            );
            res.end(result.buffer);
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
