import { supabase } from './supabase';

export const COVER_BUCKET = 'portfolio-covers';

const TIKTOK_CDN_REGEX = /(^|\.)(tiktokcdn[\w-]*|muscdn)\.com$/i;

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
  const query = new URLSearchParams({ id });
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

export function resolveCoverUrl(path: string | null | undefined): string {
  if (!path) return '';

  const trimmed = path.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    if (isTikTokCdnUrl(trimmed)) {
      return '';
    }
    return trimmed;
  }

  if (trimmed.startsWith('covers/')) {
    const { data } = supabase.storage.from(COVER_BUCKET).getPublicUrl(trimmed);
    return data.publicUrl || '';
  }

  return '';
}
