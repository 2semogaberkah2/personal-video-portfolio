export type ExternalVideoSource = 'tiktok' | 'youtube';

export function getExternalVideoInfo(input: string): { source: ExternalVideoSource; id: string; embedUrl: string; thumbnail: string } {
  let url: URL;
  try { url = new URL(input.trim()); } catch { throw new Error('Masukkan link video yang valid.'); }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be' || host.endsWith('youtube.com') || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    else if (url.pathname === '/watch') id = url.searchParams.get('v') ?? '';
    else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) id = parts[1] ?? '';
    }
    if (!/^[\w-]{11}$/.test(id)) throw new Error('Link YouTube tidak dikenali. Gunakan link video YouTube biasa atau Shorts.');
    return { source: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (!match) throw new Error('Link TikTok tidak dikenali. Salin link langsung dari video TikTok.');
    return { source: 'tiktok', id: match[1], embedUrl: `https://www.tiktok.com/player/v1/${match[1]}?music_info=1&description=1`, thumbnail: '' };
  }
  throw new Error('Sumber belum didukung. Gunakan link TikTok atau YouTube.');
}

export function encodeExternalVideo(source: ExternalVideoSource, url: string): string {
  return `external:${source}:${encodeURIComponent(url.trim())}`;
}

export function decodeExternalVideo(value: string): { source: ExternalVideoSource; url: string } | null {
  const match = value.match(/^external:(tiktok|youtube):(.+)$/);
  if (!match) return null;
  try { return { source: match[1] as ExternalVideoSource, url: decodeURIComponent(match[2]) }; }
  catch { return null; }
}
