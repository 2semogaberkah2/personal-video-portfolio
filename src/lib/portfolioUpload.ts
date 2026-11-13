import { supabase } from './supabase';
import { decodeExternalVideo } from './externalVideo';
import { COVER_BUCKET } from './cover';

export type NewPortfolioVideo = {
  title: string;
  client: string;
  category: string;
  description: string;
  role: string;
  published: boolean;
  aspectRatio: '9:16' | '16:9' | '1:1';
  displayOrder: number;
};

const BUCKET = 'portfolio-videos';
const MAX_ORIGINAL_SIZE = 50 * 1024 * 1024;
const MAX_PREVIEW_SIZE = 15 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024;

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}

async function uploadAsset(
  userId: string,
  file: File | Blob,
  contentType: string,
  customPath?: string
): Promise<string> {
  const fileName = 'name' in file ? (file as File).name : 'asset.jpg';
  const path = customPath || `${userId}/${crypto.randomUUID()}-${safeFileName(fileName)}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  return path;
}

export async function uploadTikTokCoverFile(id: string, file: File | Blob): Promise<string> {
  const cleanId = id.trim();
  if (!cleanId) throw new Error('ID TikTok tidak boleh kosong.');

  const type = (file.type || '').toLowerCase();
  let ext = 'jpg';
  if (type.includes('png')) ext = 'png';
  else if (type.includes('webp')) ext = 'webp';
  else if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
  else {
    throw new Error('Format cover harus JPG, PNG, atau WebP.');
  }

  if (file.size > MAX_THUMBNAIL_SIZE) {
    throw new Error('Ukuran cover maksimal 2 MB.');
  }

  const coverPath = `covers/tiktok-${cleanId}.${ext}`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(coverPath, file, {
      upsert: true,
      contentType: file.type || `image/${ext}`,
      cacheControl: '86400',
    });

  if (error) {
    throw new Error(`Upload cover gagal: ${error.message}`);
  }

  return coverPath;
}

export async function persistTikTokCover(url: string, id: string): Promise<string> {
  try {
    const query = new URLSearchParams({ id: id.trim() });
    if (url.trim()) query.set('url', url.trim());

    const res = await fetch(`/api/tiktok-thumb?${query.toString()}`);
    if (!res.ok) return '';

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return '';

    const blob = await res.blob();
    return await uploadTikTokCoverFile(id, blob);
  } catch (err) {
    console.warn('persistTikTokCover error:', err);
    return '';
  }
}

export async function uploadPortfolioVideo(
  file: File,
  details: NewPortfolioVideo,
  previewFile?: File | null,
  thumbnailFile?: File | null
): Promise<void> {
  if (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4')) {
    throw new Error('Video asli harus berformat MP4.');
  }

  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error('Ukuran video asli maksimal 50 MB.');
  }

  if (
    previewFile &&
    previewFile.type !== 'video/mp4' &&
    !previewFile.name.toLowerCase().endsWith('.mp4')
  ) {
    throw new Error('Video preview harus berformat MP4.');
  }

  if (previewFile && previewFile.size > MAX_PREVIEW_SIZE) {
    throw new Error('Ukuran video preview maksimal 15 MB.');
  }

  if (thumbnailFile && thumbnailFile.size > MAX_THUMBNAIL_SIZE) {
    throw new Error('Ukuran thumbnail maksimal 2 MB.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Sesi admin tidak ditemukan. Silakan login ulang.');
  }

  const originalPath = await uploadAsset(user.id, file, 'video/mp4');

  let previewPath: string | null = null;
  if (previewFile) {
    previewPath = await uploadAsset(user.id, previewFile, 'video/mp4');
  }

  let thumbnailPath: string | null = null;
  if (thumbnailFile) {
    thumbnailPath = await uploadAsset(
      user.id,
      thumbnailFile,
      thumbnailFile.type || 'image/jpeg'
    );
  }

  const { error: insertError } = await supabase.from('portfolio_videos').insert({
    title: details.title.trim(),
    client: details.client.trim() || null,
    category: details.category.trim(),
    description: details.description.trim() || null,
    role: details.role.trim() || null,
    file_path: originalPath,
    preview_path: previewPath,
    thumbnail_path: thumbnailPath,
    published: details.published,
    aspect_ratio: details.aspectRatio,
    display_order: details.displayOrder,
  });

  if (insertError) {
    throw new Error(`Data video gagal disimpan: ${insertError.message}`);
  }
}

export async function deletePortfolioVideo(
  id: string,
  filePath: string,
  previewPath?: string | null,
  thumbnailPath?: string | null
): Promise<void> {
  const isExternal = Boolean(decodeExternalVideo(filePath));

  if (!isExternal && filePath) {
    const toRemove = [filePath, previewPath, thumbnailPath].filter(Boolean) as string[];
    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove);
    }
  } else if (isExternal && thumbnailPath && thumbnailPath.startsWith('covers/')) {
    // Hapus cover TikTok dari bucket portfolio-covers
    await supabase.storage.from(COVER_BUCKET).remove([thumbnailPath]);
  }

  const { error } = await supabase.from('portfolio_videos').delete().eq('id', id);
  if (error) {
    throw new Error(`Gagal menghapus video: ${error.message}`);
  }
}
