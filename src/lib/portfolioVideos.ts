import { supabase } from './supabase';
import type { VideoProject } from '../data/projects';
import { decodeExternalVideo, getExternalVideoInfo } from './externalVideo';
import { resolveCoverUrl, tiktokProxyUrl } from './cover';

type PortfolioVideoRow = {
  id: string;
  title: string;
  client: string | null;
  category: string;
  description: string | null;
  role: string | null;
  file_path: string;
  preview_path: string | null;
  thumbnail_path: string | null;
  published: boolean;
  aspect_ratio: '9:16' | '16:9' | '1:1';
  created_at: string;
  display_order: number;
};

const BUCKET = 'portfolio-videos';
const SIGNED_URL_DURATION = 60 * 60; // 3600 detik
const CACHE_TTL_MS = 50 * 60 * 1000; // 50 menit (di bawah masa berlaku signed URL)

let cachedPromise: Promise<VideoProject[]> | null = null;
let cacheTimestamp = 0;

async function fetchPortfolioVideosFromSupabase(): Promise<VideoProject[]> {
  const { data, error } = await supabase
    .from('portfolio_videos')
    .select(
      'id, title, client, category, description, role, file_path, preview_path, thumbnail_path, published, aspect_ratio, created_at, display_order'
    )
    .eq('published', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil video: ${error.message}`);
  }

  const rows = (data ?? []) as PortfolioVideoRow[];

  // Kumpulkan path thumbnail privat dari bucket portfolio-videos untuk batch signing
  const privateThumbPaths = Array.from(
    new Set(
      rows
        .filter((r) => {
          const external = decodeExternalVideo(r.file_path);
          if (external) return false;
          if (!r.thumbnail_path) return false;
          const trimmed = r.thumbnail_path.trim();
          return !trimmed.startsWith('covers/') && !/^https?:\/\//i.test(trimmed);
        })
        .map((r) => r.thumbnail_path!.trim())
    )
  );

  const signedThumbMap: Record<string, string> = {};

  if (privateThumbPaths.length > 0) {
    try {
      const { data: batchData, error: batchError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(privateThumbPaths, SIGNED_URL_DURATION);

      if (!batchError && Array.isArray(batchData)) {
        for (const item of batchData) {
          if (item?.path && item.signedUrl) {
            signedThumbMap[item.path] = item.signedUrl;
          }
        }
      }
    } catch (err) {
      console.warn('Batch createSignedUrls thumbnail gagal:', err);
    }
  }

  const results = await Promise.all(
    rows.map(async (row): Promise<VideoProject | null> => {
      try {
        const external = decodeExternalVideo(row.file_path);

        if (external) {
          const info = getExternalVideoInfo(external.url);
          const resolvedCover = resolveCoverUrl(row.thumbnail_path);
          const thumbnail =
            resolvedCover || (external.source === 'youtube' ? info.thumbnail : '');

          const thumbnailFallbacks =
            external.source === 'tiktok'
              ? [tiktokProxyUrl(info.id, external.url)]
              : undefined;

          return {
            id: row.id,
            title: row.title,
            client: row.client ?? undefined,
            category: row.category,
            thumbnail,
            thumbnailFallbacks,
            description: row.description ?? undefined,
            role: row.role ?? undefined,
            published: row.published,
            aspectRatio: row.aspect_ratio,
            videoSource: external.source,
            tiktokVideoId: external.source === 'tiktok' ? info.id : undefined,
            youtubeVideoId: external.source === 'youtube' ? info.id : undefined,
            externalUrl: external.url,
          };
        }

        // Jalur Upload MP4
        const { data: fullData, error: fullError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.file_path, SIGNED_URL_DURATION);

        if (fullError || !fullData?.signedUrl) {
          throw new Error(fullError?.message ?? 'URL video asli tidak tersedia.');
        }

        let previewVideo = fullData.signedUrl;
        if (row.preview_path) {
          const { data: previewData, error: previewError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(row.preview_path, SIGNED_URL_DURATION);
          if (!previewError && previewData?.signedUrl) {
            previewVideo = previewData.signedUrl;
          }
        }

        let thumbnail = resolveCoverUrl(row.thumbnail_path);
        if (!thumbnail && row.thumbnail_path) {
          thumbnail = signedThumbMap[row.thumbnail_path.trim()] ?? '';
        }

        return {
          id: row.id,
          title: row.title,
          client: row.client ?? undefined,
          category: row.category,
          thumbnail,
          previewVideo,
          fullVideo: fullData.signedUrl,
          description: row.description ?? undefined,
          role: row.role ?? undefined,
          published: row.published,
          aspectRatio: row.aspect_ratio,
          videoSource: 'upload',
        };
      } catch (err) {
        console.warn(`Video "${row.title}" dilewati:`, err);
        return null;
      }
    })
  );

  return results.filter((project): project is VideoProject => project !== null);
}

export function getPublishedPortfolioVideos(): Promise<VideoProject[]> {
  const now = Date.now();
  if (cachedPromise && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPromise;
  }

  cacheTimestamp = now;
  cachedPromise = fetchPortfolioVideosFromSupabase().catch((err) => {
    cachedPromise = null;
    throw err;
  });

  return cachedPromise;
}
