import { supabase } from './supabase';

export const COVER_BUCKET = 'portfolio-covers';

const TIKTOK_CDN_REGEX =
  /(^|\.)(tiktokcdn(?:-[a-z]{2,3})?\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|tiktokv\.(?:com|us|eu)|muscdn\.com)$/i;

export function isTikTokCdnUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return TIKTOK_CDN_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}

export function tiktokProxyUrl(id: string, url?: string): string {
  const query = new URLSearchParams({ id: id.trim() });
  if (url) {
    try {
      const parsed = new URL(url.trim());
      if (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) {
        query.set('url', url.trim());
      }
    } catch {
      // url tidak valid diabaikan
    }
  }
  return `/api/tiktok-thumb?${query.toString()}`;
}

export function coverHue(id: string): number {
  if (!id) return 180;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function resolveCoverUrl(path: string | null | undefined): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('covers/')) {
    const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(trimmed);
    return data.publicUrl || '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return '';
}

export function buildCoverCandidates(params: {
  thumbnailPath?: string | null;
  tiktokId?: string | null;
  tiktokUrl?: string | null;
  youtubeId?: string | null;
  customThumbnails?: string[];
}): string[] {
  const list: string[] = [];

  // 1. Primary Supabase Storage / direct URL
  const resolved = resolveCoverUrl(params.thumbnailPath);
  if (resolved) {
    list.push(resolved);
  }

  // 2. YouTube default HQ thumbnail
  if (params.youtubeId) {
    list.push(`https://i.ytimg.com/vi/${params.youtubeId}/hqdefault.jpg`);
  }

  // 3. Custom / fallback thumbnails passed in
  if (params.customThumbnails && Array.isArray(params.customThumbnails)) {
    for (const t of params.customThumbnails) {
      if (t && typeof t === 'string' && t.trim()) {
        const res = resolveCoverUrl(t.trim());
        if (res) list.push(res);
      }
    }
  }

  // 4. TikTok serverless proxy fallback
  if (params.tiktokId) {
    list.push(tiktokProxyUrl(params.tiktokId, params.tiktokUrl || undefined));
  }

  // Deduplicate and filter non-empty
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const item of list) {
    const trimmed = item.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      deduped.push(trimmed);
    }
  }

  return deduped;
}
