import { fetchTikTokCover } from '../server/tiktokCover.js';

export default async function handler(req, res) {
  const { id, url } = req.query || {};

  if (!id || typeof id !== 'string' || !/^\d{8,25}$/.test(id.trim())) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.status(400).send('Invalid or missing TikTok ID');
    return;
  }

  const result = await fetchTikTokCover(id.trim(), typeof url === 'string' ? url : undefined, {
    tiers: ['rehydration', 'meta', 'oembed', 'embedv2'],
    allowThirdParty: false,
    deadlineMs: 8000,
  });

  if (!result || !result.ok || !result.buffer) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    res.status(404).send('Cover not found');
    return;
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('X-Cover-Tier', result.tier || 'unknown');
  res.setHeader(
    'Cache-Control',
    'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800'
  );
  res.status(200).send(result.buffer);
}
