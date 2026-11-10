#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const TIKTOK_CDN_REGEX = /(^|\.)(tiktokcdn[\w-]*|muscdn)\.com$/i;
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// 1. Parsing argumen CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const idArg = args.find((a) => a.startsWith('--id='))?.split('=')[1]?.trim() || null;

// 2. Parsing manual .env.local / .env (tanpa modul dotenv)
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
let supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

for (const envFile of ['.env.local', '.env']) {
  const p = path.join(process.cwd(), envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');

      if (!supabaseUrl && (k === 'VITE_SUPABASE_URL' || k === 'SUPABASE_URL')) {
        supabaseUrl = v;
      }
      if (
        k === 'SUPABASE_SERVICE_ROLE_KEY' ||
        (!supabaseKey && (k === 'VITE_SUPABASE_ANON_KEY' || k === 'SUPABASE_ANON_KEY'))
      ) {
        supabaseKey = v;
      }
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase URL atau Key tidak ditemukan di .env.local atau environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

function isTikTokCdn(u) {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return TIKTOK_CDN_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function ensureBucket(bucketName) {
  const { data: bucket, error: getErr } = await supabase.storage.getBucket(bucketName);
  if (!getErr && bucket) return;

  const { error: createErr } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
    console.warn(`⚠️ Warning ensureBucket: ${createErr.message}`);
  }
}

async function fetchCoverBytes(url, id, retries = 3) {
  const candidates = [
    url,
    id ? `https://www.tiktok.com/@tiktok/video/${id}` : '',
  ].filter(Boolean);

  for (let attempt = 1; attempt <= retries; attempt++) {
    for (const candidate of candidates) {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(candidate)}`;
        const res = await fetch(oembedUrl, {
          headers: {
            'User-Agent': MOBILE_UA,
            Accept: 'application/json, text/plain, */*',
          },
        });

        if (!res.ok) continue;

        const data = await res.json();
        const thumbUrl = data?.thumbnail_url;
        if (!thumbUrl || typeof thumbUrl !== 'string') continue;

        const thumbParsed = new URL(thumbUrl);
        if (!TIKTOK_CDN_REGEX.test(thumbParsed.hostname)) continue;

        const imgRes = await fetch(thumbUrl, {
          headers: {
            'User-Agent': MOBILE_UA,
            Referer: 'https://www.tiktok.com/',
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        if (!imgRes.ok) continue;

        const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').toLowerCase();
        if (
          !contentType.startsWith('image/') ||
          (!contentType.includes('jpeg') &&
            !contentType.includes('jpg') &&
            !contentType.includes('png') &&
            !contentType.includes('webp'))
        ) {
          continue;
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        if (arrayBuffer.byteLength > 2 * 1024 * 1024) continue;

        let ext = 'jpg';
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';

        return {
          buffer: Buffer.from(arrayBuffer),
          contentType,
          ext,
        };
      } catch {
        // coba kandidat berikutnya
      }
    }

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, attempt * 500));
    }
  }

  return null;
}

async function main() {
  console.log('--- BACKFILL TIKTOK COVERS KE SUPABASE STORAGE ---');
  if (dryRun) console.log('[MODE DRY RUN: Tidak ada penulisan data ke storage atau database]');

  await ensureBucket('portfolio-covers');

  let query = supabase
    .from('portfolio_videos')
    .select('id, title, file_path, thumbnail_path')
    .order('display_order', { ascending: true });

  if (idArg) {
    query = query.eq('id', idArg);
  }

  const { data: rows, error: selectErr } = await query;
  if (selectErr) {
    console.error('❌ Gagal membaca portfolio_videos:', selectErr.message);
    process.exit(1);
  }

  const targets = (rows || [])
    .map((r) => {
      const match = (r.file_path || '').match(/^external:tiktok:(.+)$/);
      if (!match) return null;
      let url = '';
      try {
        url = decodeURIComponent(match[1]);
      } catch {
        return null;
      }
      const idMatch = url.match(/\/video\/(\d+)/);
      if (!idMatch) return null;
      return {
        rowId: r.id,
        title: r.title,
        url,
        tiktokId: idMatch[1],
        thumb: r.thumbnail_path,
      };
    })
    .filter(Boolean)
    .filter((t) => force || !t.thumb || isTikTokCdn(t.thumb) || !t.thumb.startsWith('covers/'));

  console.log(`Ditemukan ${targets.length} target video TikTok yang perlu cover permanen.\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] "${t.title}" (ID: ${t.tiktokId})... `);

    const cover = await fetchCoverBytes(t.url, t.tiktokId);

    if (!cover) {
      console.log('✗ Gagal mengunduh cover (oEmbed/CDN tidak merespons)');
      fail++;
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    const storagePath = `covers/tiktok-${t.tiktokId}.${cover.ext}`;

    if (dryRun) {
      console.log(`✓ [DRY-RUN OK] bytes: ${cover.buffer.length}, target: ${storagePath}`);
      ok++;
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    const { error: uploadErr } = await supabase.storage
      .from('portfolio-covers')
      .upload(storagePath, cover.buffer, {
        upsert: true,
        contentType: cover.contentType,
        cacheControl: '86400',
      });

    if (uploadErr) {
      console.log(`✗ Upload storage gagal: ${uploadErr.message}`);
      fail++;
      await new Promise((r) => setTimeout(r, 400));
      continue;
    }

    const { error: updateErr } = await supabase
      .from('portfolio_videos')
      .update({ thumbnail_path: storagePath })
      .eq('id', t.rowId);

    if (updateErr) {
      console.log(`✗ Update database gagal: ${updateErr.message}`);
      fail++;
    } else {
      console.log(`✓ Tersimpan permanen (${storagePath})`);
      ok++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n======================================================');
  console.log(`Ringkasan Backfill: ${ok} sukses, ${fail} gagal dari ${targets.length} target.`);
  console.log('======================================================\n');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
