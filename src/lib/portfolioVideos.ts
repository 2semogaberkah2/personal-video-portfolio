import { supabase } from './supabase';
import type { VideoProject } from '../data/projects';

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
};

const BUCKET = 'portfolio-videos';
const SIGNED_URL_DURATION = 60 * 60;

export async function getPublishedPortfolioVideos(): Promise<VideoProject[]> {
  const { data, error } = await supabase
    .from('portfolio_videos')
    .select(
      'id, title, client, category, description, role, file_path, preview_path, thumbnail_path, published, aspect_ratio, created_at'
    )
    .eq('published', true)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Gagal mengambil video: ${error.message}`);
  }

  const rows = (data ?? []) as PortfolioVideoRow[];

  const results = await Promise.all(
    rows.map(async (row): Promise<VideoProject | null> => {
      try {
        const { data: fullData, error: fullError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(row.file_path, SIGNED_URL_DURATION);

        if (fullError || !fullData?.signedUrl) {
          throw new Error(
            fullError?.message ?? 'URL video asli tidak tersedia.'
          );
        }

        let previewVideo = fullData.signedUrl;

        if (row.preview_path) {
          const { data: previewData, error: previewError } =
            await supabase.storage
              .from(BUCKET)
              .createSignedUrl(row.preview_path, SIGNED_URL_DURATION);

          if (!previewError && previewData?.signedUrl) {
            previewVideo = previewData.signedUrl;
          } else {
            console.warn(
              `Preview video "${row.title}" tidak tersedia; menggunakan video asli.`
            );
          }
        }

        let thumbnail = '';

        if (row.thumbnail_path) {
          const { data: thumbnailData, error: thumbnailError } =
            await supabase.storage
              .from(BUCKET)
              .createSignedUrl(row.thumbnail_path, SIGNED_URL_DURATION);

          if (!thumbnailError && thumbnailData?.signedUrl) {
            thumbnail = thumbnailData.signedUrl;
          } else {
            console.warn(
              `Thumbnail video "${row.title}" tidak tersedia.`
            );
          }
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
        };
      } catch (error) {
        console.warn(
          `Video "${row.title}" dilewati karena gagal dimuat:`,
          error instanceof Error ? error.message : error
        );
        return null;
      }
    })
  );

  return results.filter(
    (project): project is VideoProject => project !== null
  );
}
