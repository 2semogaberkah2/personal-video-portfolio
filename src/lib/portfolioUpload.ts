import { supabase } from './supabase';

export type NewPortfolioVideo = {
  title: string;
  client: string;
  category: string;
  description: string;
  role: string;
  published: boolean;
  aspectRatio: '9:16' | '16:9' | '1:1';
};

const BUCKET = 'portfolio-videos';
const MAX_ORIGINAL_SIZE = 50 * 1024 * 1024;
const MAX_PREVIEW_SIZE = 15 * 1024 * 1024;
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024;


function safeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

async function uploadAsset(
  userId: string,
  file: File,
  contentType: string
): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload ${file.name} gagal: ${error.message}`);
  }

  return path;
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

    const { error: insertError } = await supabase
      .from('portfolio_videos')
      .insert({
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
      });

    if (insertError) {
      throw new Error(`Data video gagal disimpan: ${insertError.message}`);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET)
        .remove(uploadedPaths);

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
  const paths = [filePath, previewPath, thumbnailPath].filter(
    (path): path is string => Boolean(path)
  );

  const { error: databaseError } = await supabase
    .from('portfolio_videos')
    .delete()
    .eq('id', id);

  if (databaseError) {
    throw new Error(`Data video gagal dihapus: ${databaseError.message}`);
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(paths);

  if (storageError) {
    throw new Error(
      `Data video sudah dihapus, tetapi sebagian file Storage mungkin masih tersisa: ${storageError.message}`
    );
  }
}

