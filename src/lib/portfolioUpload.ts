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

export async function persistTikTokCover(url: string, id: string): Promise<string> {
  try {
    const query = new URLSearchParams({ id: id.trim() });
    if (url.trim()) query.set('url', url.trim());

    const res = await fetch(`/api/tiktok-thumb?${query.toString()}`);
    if (!res.ok) return '';

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return '';

    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else return '';

    const blob = await res.blob();
    if (blob.size > MAX_THUMBNAIL_SIZE) return '';

    const coverPath = `covers/tiktok-${id.trim()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(COVER_BUCKET)
      .upload(coverPath, blob, {
        upsert: true,
        contentType,
        cacheControl: '86400',
      });

    if (uploadError) {
      console.warn('Upload cover TikTok ke storage gagal:', uploadError.message);
      return '';
    }

    return coverPath;
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

  if (
    thumbnailFile &&
    !['image/jpeg', 'image/jpg'].includes(thumbnailFile.type) &&
    !thumbnailFile.name.toLowerCase().match(/\.jpe?g$/)
  ) {
    throw new Error('Thumbnail harus berformat JPG atau JPEG.');
  }

  if (thumbnailFile && thumbnailFile.size > MAX_THUMBNAIL_SIZE) {
    throw new Error('Ukuran thumbnail maksimal 2 MB.');
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Sesi admin tidak ditemukan. Silakan login kembali.');
  }

  const uploadedPaths: string[] = [];

  try {
    const filePath = await uploadAsset(user.id, file, 'video/mp4');
    uploadedPaths.push(filePath);

    let previewPath: string | null = null;
    let thumbnailPath: string | null = null;

    if (previewFile) {
      previewPath = await uploadAsset(user.id, previewFile, 'video/mp4');
      uploadedPaths.push(previewPath);
    }

    if (thumbnailFile) {
      thumbnailPath = await uploadAsset(user.id, thumbnailFile, 'image/jpeg');
      uploadedPaths.push(thumbnailPath);
    }

    const { error: insertError } = await supabase.from('portfolio_videos').insert({
      title: details.title.trim(),
      client: details.client.trim() || null,
      category: details.category,
      description: details.description.trim() || null,
      role: details.role.trim() || null,
      file_path: filePath,
      preview_path: previewPath,
      thumbnail_path: thumbnailPath,
      published: details.published,
      aspect_ratio: details.aspectRatio,
      display_order: details.displayOrder,
    });

    if (insertError) {
      throw new Error(`Data video gagal disimpan: ${insertError.message}`);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage.from(BUCKET).remove(uploadedPaths);
      if (cleanupError) {
        console.error('Pembersihan file gagal:', cleanupError.message);
      }
    }

    throw error;
  }
}

export async function deletePortfolioVideo(
  id: string,
  filePath: string,
  previewPath?: string | null,
  thumbnailPath?: string | null
): Promise<void> {
  const isExternal = Boolean(decodeExternalVideo(filePath));

  // Jika thumbnail berada di bucket publik portfolio-covers, hapus objeknya
  if (thumbnailPath?.startsWith('covers/')) {
    await supabase.storage
      .from(COVER_BUCKET)
      .remove([thumbnailPath])
      .catch((err: unknown) => {
        console.warn('Gagal menghapus cover dari portfolio-covers:', err);
      });
  }

  const { error: databaseError } = await supabase
    .from('portfolio_videos')
    .delete()
    .eq('id', id);

  if (databaseError) {
    throw new Error(`Data video gagal dihapus: ${databaseError.message}`);
  }

  if (isExternal) return;

  const paths = [filePath, previewPath, thumbnailPath].filter(
    (path): path is string => Boolean(path && !path.startsWith('covers/'))
  );

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) {
      throw new Error(
        `Data video sudah dihapus, tetapi sebagian file Storage mungkin masih tersisa: ${storageError.message}`
      );
    }
  }
}
