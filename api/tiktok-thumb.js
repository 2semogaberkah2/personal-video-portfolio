export default async function handler(req, res) {
  const { url, id } = req.query || {};
  const targetUrl =
    typeof url === 'string' && url.trim()
      ? url.trim()
      : typeof id === 'string' && id.trim()
        ? `https://www.tiktok.com/@tiktok/video/${id.trim()}`
        : '';

  if (!targetUrl) {
    res.status(400).send('Missing TikTok URL or ID');
    return;
  }

  const candidateUrls = [targetUrl];
  if (typeof id === 'string' && id.trim()) {
    const canonical = `https://www.tiktok.com/@tiktok/video/${id.trim()}`;
    if (!candidateUrls.includes(canonical)) {
      candidateUrls.push(canonical);
    }
  }

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    Accept: 'application/json, text/plain, */*',
  };

  let thumbnailUrl = '';

  for (const candidate of candidateUrls) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(candidate)}`;
      const response = await fetch(oembedUrl, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.thumbnail_url === 'string' && data.thumbnail_url) {
          thumbnailUrl = data.thumbnail_url;
          break;
        }
      }
    } catch {
      // try next candidate
    }
  }

  if (!thumbnailUrl) {
    res.status(404).send('Thumbnail not found');
    return;
  }

  try {
    const imgResponse = await fetch(thumbnailUrl, {
      headers: {
        'User-Agent': headers['User-Agent'],
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.tiktok.com/',
      },
    });

    if (!imgResponse.ok) {
      res.redirect(302, thumbnailUrl);
      return;
    }

    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).send(buffer);
  } catch {
    res.redirect(302, thumbnailUrl);
  }
}
