const TIKTOK_CDN_REGEX = /(^|\.)(tiktokcdn[\w-]*|muscdn)\.com$/i;

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

export async function fetchTikTokCover(id, url) {
  if (!id || typeof id !== 'string') return null;
  const cleanId = id.trim();
  if (!/^\d{8,25}$/.test(cleanId)) return null;

  const candidateUrls = [];

  if (url && typeof url === 'string') {
    try {
      const parsed = new URL(url.trim());
      if (parsed.hostname === 'tiktok.com' || parsed.hostname.endsWith('.tiktok.com')) {
        candidateUrls.push(url.trim());
      }
    } catch {
      // url tidak valid diabaikan
    }
  }

  const canonicalUrl = `https://www.tiktok.com/@tiktok/video/${cleanId}`;
  if (!candidateUrls.includes(canonicalUrl)) {
    candidateUrls.push(canonicalUrl);
  }

  let thumbnailUrl = '';

  for (const candidate of candidateUrls) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(candidate)}`;
      const res = await fetch(oembedUrl, {
        headers: {
          'User-Agent': MOBILE_UA,
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.thumbnail_url === 'string' && data.thumbnail_url) {
          try {
            const thumbParsed = new URL(data.thumbnail_url);
            if (TIKTOK_CDN_REGEX.test(thumbParsed.hostname)) {
              thumbnailUrl = data.thumbnail_url;
              break;
            }
          } catch {
            // hostname thumbnail tidak valid
          }
        }
      }
    } catch {
      // Coba kandidat berikutnya
    }
  }

  if (!thumbnailUrl) return null;

  try {
    const imgRes = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': MOBILE_UA,
        Referer: 'https://www.tiktok.com/',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!imgRes.ok) return null;

    const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').toLowerCase();
    if (
      !contentType.startsWith('image/') ||
      (!contentType.includes('jpeg') &&
        !contentType.includes('jpg') &&
        !contentType.includes('png') &&
        !contentType.includes('webp'))
    ) {
      return null;
    }

    const arrayBuffer = await imgRes.arrayBuffer();
    if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
      return null;
    }

    const buffer = Buffer.from(arrayBuffer);
    return { buffer, contentType };
  } catch {
    return null;
  }
}
