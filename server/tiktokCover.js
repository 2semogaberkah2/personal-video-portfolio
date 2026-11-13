// server/tiktokCover.js
// Multi-tier server & script cover extraction for TikTok videos

const TIKTOK_CDN_REGEX =
  /(^|\.)(tiktokcdn(?:-[a-z]{2,3})?\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|tiktokv\.(?:com|us|eu)|muscdn\.com)$/i;

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const BOT_UA =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

export function getCanonicalTikTokUrl(id, rawUrl) {
  const cleanId = (id || '').trim();
  if (rawUrl && typeof rawUrl === 'string') {
    const trimmed = rawUrl.trim();
    const match = trimmed.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.\-]+)\/video\/(\d{8,25})/i);
    if (match) {
      return `https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
    }
  }
  return cleanId ? `https://www.tiktok.com/@tiktok/video/${cleanId}` : '';
}

function sniffImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }

  // WEBP: RIFF....WEBP
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }

  // Reject HEIC/AVIF: ftypheic | ftypheix | ftypmif1 | ftypavif at byte 4-11
  const ftyp = buffer.subarray(4, 12).toString('ascii');
  if (/ftyp(heic|heix|mif1|avif)/i.test(ftyp)) {
    return null;
  }

  return null;
}

function isAllowedHost(urlStr, allowThirdParty = false) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (TIKTOK_CDN_REGEX.test(parsed.hostname)) return true;
    if (allowThirdParty && parsed.hostname === 'www.tikwm.com') return true;
    return false;
  } catch {
    return false;
  }
}

export function deepFindCover(obj, visited = new Set()) {
  if (!obj || typeof obj !== 'object' || visited.has(obj)) return null;
  visited.add(obj);

  const priorityKeys = ['originCover', 'cover', 'dynamicCover', 'coverUrl', 'thumbnailUrl'];
  for (const k of priorityKeys) {
    if (typeof obj[k] === 'string' && /^https?:\/\//i.test(obj[k])) {
      return obj[k];
    }
  }

  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && /^https?:\/\//i.test(val)) {
      if (/(originCover|cover|dynamicCover|coverUrl)/i.test(val)) {
        return val;
      }
    } else if (typeof val === 'object' && val !== null) {
      const found = deepFindCover(val, visited);
      if (found) return found;
    }
  }
  return null;
}

export async function pickImage(candidates, allowThirdParty = false, timeoutMs = 6000) {
  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [candidates].filter(Boolean);

  for (const item of list) {
    let clean = (item || '').trim();
    clean = clean
      .replace(/\\u002F/g, '/')
      .replace(/\\u0026/g, '&')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&')
      .trim();

    if (!clean || !/^https?:\/\//i.test(clean)) continue;
    if (!isAllowedHost(clean, allowThirdParty)) continue;

    try {
      const res = await fetch(clean, {
        headers: {
          'User-Agent': DESKTOP_UA,
          Referer: 'https://www.tiktok.com/',
          Accept: 'image/webp,image/jpeg,image/png,*/*;q=0.5',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) continue;

      const lenHeader = res.headers.get('content-length');
      if (lenHeader && parseInt(lenHeader, 10) > 2 * 1024 * 1024) continue;

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > 2 * 1024 * 1024) continue;

      const buf = Buffer.from(arrayBuffer);
      const sniff = sniffImageMagicBytes(buf);
      if (!sniff) continue;

      return {
        buffer: buf,
        contentType: sniff.contentType,
        ext: sniff.ext,
        sourceUrl: clean,
      };
    } catch {
      // coba kandidat berikutnya
    }
  }

  return null;
}

// Tier 1: Rehydration
export async function tierRehydration(canonicalUrl, timeoutMs = 6000) {
  try {
    const res = await fetch(canonicalUrl, {
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }

    const html = await res.text();
    let candidates = [];
    let keysFound = [];

    const rehydMatch = html.match(
      /<script[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (rehydMatch && rehydMatch[1]) {
      try {
        const parsed = JSON.parse(rehydMatch[1]);
        const videoDetail = parsed?.__DEFAULT_SCOPE__?.['webapp.video-detail'];
        if (videoDetail) {
          if (videoDetail.statusCode !== undefined && videoDetail.statusCode !== 0) {
            return { ok: false, status: 200, reason: `statusCode ${videoDetail.statusCode}` };
          }
          const v = videoDetail?.itemInfo?.itemStruct?.video;
          if (v) {
            if (v.originCover) { candidates.push(v.originCover); keysFound.push('originCover'); }
            if (v.cover) { candidates.push(v.cover); keysFound.push('cover'); }
            if (v.dynamicCover) { candidates.push(v.dynamicCover); keysFound.push('dynamicCover'); }
          }
          if (candidates.length === 0) {
            const dfs = deepFindCover(videoDetail);
            if (dfs) { candidates.push(dfs); keysFound.push('dfs'); }
          }
        }
      } catch (err) {
        // parsing error
      }
    }

    if (candidates.length === 0) {
      const sigiMatch = html.match(
        /<script[^>]*\bid=["'](?:SIGI_STATE|__NEXT_DATA__)["'][^>]*>([\s\S]*?)<\/script>/i
      );
      if (sigiMatch && sigiMatch[1]) {
        try {
          const parsed = JSON.parse(sigiMatch[1]);
          const dfs = deepFindCover(parsed);
          if (dfs) { candidates.push(dfs); keysFound.push('sigi_dfs'); }
        } catch {
          // ignore
        }
      }
    }

    if (candidates.length === 0) {
      return { ok: false, status: 200, reason: 'No cover keys in rehydration/sigi script' };
    }

    const picked = await pickImage(candidates, false, timeoutMs);
    if (!picked) {
      return { ok: false, status: 200, reason: 'Image download/sniff failed', keysFound, candidates };
    }

    return {
      ok: true,
      status: 200,
      buffer: picked.buffer,
      contentType: picked.contentType,
      ext: picked.ext,
      sourceUrl: picked.sourceUrl,
      keysFound,
    };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

// Tier 2: OpenGraph & Twitter Meta tags
export async function tierMeta(canonicalUrl, timeoutMs = 6000) {
  const userAgents = [BOT_UA, DESKTOP_UA];

  for (const ua of userAgents) {
    try {
      const res = await fetch(canonicalUrl, {
        headers: {
          'User-Agent': ua,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) continue;

      const html = await res.text();
      const candidates = [];

      const regex1 =
        /<meta\b[^>]*?\b(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*?\bcontent=["']([^"']+)["']/gi;
      const regex2 =
        /<meta\b[^>]*?\bcontent=["']([^"']+)["'][^>]*?\b(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["']/gi;

      let m;
      while ((m = regex1.exec(html)) !== null) {
        if (m[1]) candidates.push(m[1]);
      }
      while ((m = regex2.exec(html)) !== null) {
        if (m[1]) candidates.push(m[1]);
      }

      if (candidates.length === 0) continue;

      const picked = await pickImage(candidates, false, timeoutMs);
      if (picked) {
        return {
          ok: true,
          status: 200,
          buffer: picked.buffer,
          contentType: picked.contentType,
          ext: picked.ext,
          sourceUrl: picked.sourceUrl,
          keysFound: ['og:image'],
        };
      }
    } catch {
      // try next UA
    }
  }

  return { ok: false, status: 0, reason: 'No valid meta cover tags found' };
}

// Tier 3: oEmbed
export async function tierOembed(canonicalUrl, id, timeoutMs = 6000) {
  const candidates = [canonicalUrl, id ? `https://www.tiktok.com/@tiktok/video/${id}` : ''].filter(Boolean);

  for (const c of candidates) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(c)}`;
      const res = await fetch(oembedUrl, {
        headers: {
          'User-Agent': DESKTOP_UA,
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const keys = data ? Object.keys(data) : [];

      if (data && typeof data.thumbnail_url === 'string' && data.thumbnail_url.trim()) {
        const picked = await pickImage([data.thumbnail_url], false, timeoutMs);
        if (picked) {
          return {
            ok: true,
            status: 200,
            buffer: picked.buffer,
            contentType: picked.contentType,
            ext: picked.ext,
            sourceUrl: picked.sourceUrl,
            keysFound: keys,
          };
        }
      }
      return { ok: false, status: 200, reason: 'oEmbed missing thumbnail_url', keysFound: keys };
    } catch (err) {
      // continue
    }
  }

  return { ok: false, status: 0, reason: 'oEmbed endpoints unreachable' };
}

// Tier 4: embedv2
export async function tierEmbedV2(id, timeoutMs = 6000) {
  if (!id) return { ok: false, status: 0, reason: 'Missing id for embedv2' };
  try {
    const embedUrl = `https://www.tiktok.com/embed/v2/${id}`;
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': DESKTOP_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const candidates = [];

    const re = /"(?:originCover|cover|coverUrl|thumbnailUrl|dynamicCover)"\s*:\s*"(https?:[^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (m[1]) {
        try {
          const unescaped = JSON.parse(`"${m[1]}"`);
          candidates.push(unescaped);
        } catch {
          candidates.push(m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/'));
        }
      }
    }

    if (candidates.length === 0) {
      return { ok: false, status: 200, reason: 'No cover keys in embedv2 HTML' };
    }

    const picked = await pickImage(candidates, false, timeoutMs);
    if (!picked) {
      return { ok: false, status: 200, reason: 'pickImage failed for embedv2 candidates' };
    }

    return {
      ok: true,
      status: 200,
      buffer: picked.buffer,
      contentType: picked.contentType,
      ext: picked.ext,
      sourceUrl: picked.sourceUrl,
      keysFound: ['embedv2_keys'],
    };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

// Tier 5: TikWM
export async function tierTikwm(canonicalUrl, timeoutMs = 8000) {
  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(canonicalUrl)}&hd=1`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent': DESKTOP_UA,
        Accept: 'application/json, text/plain, */*',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data || data.code !== 0) {
      return { ok: false, status: 200, reason: data?.msg || `code ${data?.code}` };
    }

    let u = data.data?.origin_cover || data.data?.cover || data.data?.ai_dynamic_cover;
    if (!u) {
      return { ok: false, status: 200, reason: 'TikWM returned no cover properties' };
    }

    if (u.startsWith('/')) {
      u = `https://www.tikwm.com${u}`;
    }

    const picked = await pickImage([u], true, timeoutMs);
    if (!picked) {
      return { ok: false, status: 200, reason: 'TikWM image download/sniff failed', candidate: u };
    }

    return {
      ok: true,
      status: 200,
      buffer: picked.buffer,
      contentType: picked.contentType,
      ext: picked.ext,
      sourceUrl: picked.sourceUrl,
      keysFound: ['tikwm_cover'],
    };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

export async function fetchTikTokCover(id, url, opts = {}) {
  const tiers = opts.tiers || ['rehydration', 'meta', 'oembed', 'embedv2'];
  const allowThirdParty = Boolean(opts.allowThirdParty);
  const deadlineMs = opts.deadlineMs || 8000;
  const startTime = Date.now();

  const cleanId = (id || '').trim();
  const canonicalUrl = getCanonicalTikTokUrl(cleanId, url);
  const attempts = [];

  for (const tier of tiers) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= deadlineMs) {
      attempts.push({ tier, status: 408, reason: 'Global deadline exceeded' });
      break;
    }

    const remainingTimeout = Math.max(1500, Math.min(6000, deadlineMs - elapsed));

    let result = null;
    if (tier === 'rehydration') {
      result = await tierRehydration(canonicalUrl, remainingTimeout);
    } else if (tier === 'meta') {
      result = await tierMeta(canonicalUrl, remainingTimeout);
    } else if (tier === 'oembed') {
      result = await tierOembed(canonicalUrl, cleanId, remainingTimeout);
    } else if (tier === 'embedv2') {
      result = await tierEmbedV2(cleanId, remainingTimeout);
    } else if (tier === 'tikwm') {
      if (allowThirdParty) {
        result = await tierTikwm(canonicalUrl, remainingTimeout);
      } else {
        attempts.push({ tier, status: 403, reason: 'Third-party tiers disabled in runtime' });
        continue;
      }
    }

    if (result && result.ok) {
      return {
        ok: true,
        buffer: result.buffer,
        contentType: result.contentType,
        ext: result.ext,
        tier,
        sourceUrl: result.sourceUrl,
      };
    }

    attempts.push({
      tier,
      status: result?.status || 0,
      reason: result?.reason || 'Failed without exception',
    });
  }

  return { ok: false, attempts };
}
