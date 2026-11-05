import { supabase } from './supabase';
import type { VideoProject } from '../data/projects';
import { decodeExternalVideo, getExternalVideoInfo } from './externalVideo';

type PortfolioVideoRow = {
  id: string; title: string; client: string | null; category: string;
  description: string | null; role: string | null; file_path: string;
  preview_path: string | null; thumbnail_path: string | null; published: boolean;
  aspect_ratio: '9:16' | '16:9' | '1:1'; created_at: string; display_order: number;
};
const BUCKET = 'portfolio-videos';
const SIGNED_URL_DURATION = 60 * 60;

export async function getPublishedPortfolioVideos(): Promise<VideoProject[]> {
  const { data, error } = await supabase.from('portfolio_videos')
    .select('id, title, client, category, description, role, file_path, preview_path, thumbnail_path, published, aspect_ratio, created_at, display_order')
    .eq('published', true).order('display_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) throw new Error(`Gagal mengambil video: ${error.message}`);

  const rows = (data ?? []) as PortfolioVideoRow[];
  const results = await Promise.all(rows.map(async (row): Promise<VideoProject | null> => {
    try {
      const external = decodeExternalVideo(row.file_path);
      if (external) {
        const info = getExternalVideoInfo(external.url);
        return {
          id: row.id, title: row.title, client: row.client ?? undefined, category: row.category,
          thumbnail: row.thumbnail_path || info.thumbnail, description: row.description ?? undefined,
          role: row.role ?? undefined, published: row.published, aspectRatio: row.aspect_ratio,
          videoSource: external.source, tiktokVideoId: external.source === 'tiktok' ? info.id : undefined,
          youtubeVideoId: external.source === 'youtube' ? info.id : undefined,
          externalUrl: external.url,
        };
      }

      const { data: fullData, error: fullError } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, SIGNED_URL_DURATION);
      if (fullError || !fullData?.signedUrl) throw new Error(fullError?.message ?? 'URL video asli tidak tersedia.');
      let previewVideo = fullData.signedUrl;
      if (row.preview_path) {
        const { data: previewData, error: previewError } = await supabase.storage.from(BUCKET).createSignedUrl(row.preview_path, SIGNED_URL_DURATION);
        if (!previewError && previewData?.signedUrl) previewVideo = previewData.signedUrl;
      }
      let thumbnail = '';
      if (row.thumbnail_path) {
        const { data: thumbData } = await supabase.storage.from(BUCKET).createSignedUrl(row.thumbnail_path, SIGNED_URL_DURATION);
        thumbnail = thumbData?.signedUrl ?? '';
      }
      return { id: row.id, title: row.title, client: row.client ?? undefined, category: row.category,
        thumbnail, previewVideo, fullVideo: fullData.signedUrl, description: row.description ?? undefined,
        role: row.role ?? undefined, published: row.published, aspectRatio: row.aspect_ratio, videoSource: 'upload' };
    } catch (err) {
      console.warn(`Video "${row.title}" dilewati:`, err);
      return null;
    }
  }));
  return results.filter((project): project is VideoProject => project !== null);
}
