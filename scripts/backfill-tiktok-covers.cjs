#!/usr/bin/env node

/**
 * scripts/backfill-tiktok-covers.cjs
 * Multi-tier extraction & synchronization of TikTok covers to Supabase Storage
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { createClient } = require('@supabase/supabase-js');

const TIKTOK_CDN_REGEX =
  /(^|\.)(tiktokcdn(?:-[a-z]{2,3})?\.com|byteoversea\.com|ibyteimg\.com|ibytedtos\.com|tiktokv\.(?:com|us|eu)|muscdn\.com)$/i;

// 1. Parsing argumen CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const verify = args.includes('--verify');

const probeArg = args.find((a) => a.startsWith('--probe='))?.split('=')[1]?.trim() ||
  (args.includes('--probe') ? args[args.indexOf('--probe') + 1] : null);

const fromDirArg = args.find((a) => a.startsWith('--from-dir='))?.split('=')[1]?.trim() ||
  (args.includes('--from-dir') ? args[args.indexOf('--from-dir') + 1] : null);

const idArg = args.find((a) => a.startsWith('--id='))?.split('=')[1]?.trim() || null;
const tiersArg = args.find((a) => a.startsWith('--tiers='))?.split('=')[1]?.trim() || null;

// 2. Parsing manual .env.local / .env
let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

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
      if (!serviceRoleKey && k === 'SUPABASE_SERVICE_ROLE_KEY') {
        serviceRoleKey = v;
      }
      if (!anonKey && (k === 'VITE_SUPABASE_ANON_KEY' || k === 'SUPABASE_ANON_KEY')) {
        anonKey = v;
      }
    }
  }
}

const activeKey = serviceRoleKey || anonKey;

if (!supabaseUrl || !activeKey) {
  console.error('❌ Error: Supabase URL atau Key tidak ditemukan di .env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, activeKey, {
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
  try {
    const { data: bucket, error: getErr } = await supabase.storage.getBucket(bucketName);
    if (!getErr && bucket) return;

    const { error: createErr } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });

    if (createErr && !createErr.message.toLowerCase().includes('already exists')) {
      if (!serviceRoleKey) {
        console.warn('ℹ️ Pastikan bucket "portfolio-covers" sudah dibuat di Supabase SQL Editor.');
      }
    }
  } catch {
    // abaikan jika bucket sudah ada
  }
}

async function checkUrlHead200(urlStr) {
  try {
    const res = await fetch(urlStr, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

function sniffLocalImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { ext: 'png', contentType: 'image/png' };
  }
  const riff = buf.subarray(0, 4).toString('ascii');
  const webp = buf.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  return null;
}

async function main() {
  const tiktokCoverModulePath = pathToFileURL(path.resolve(__dirname, '../server/tiktokCover.js')).href;
  const {
    fetchTikTokCover,
    getCanonicalTikTokUrl,
    tierRehydration,
    tierMeta,
    tierOembed,
    tierEmbedV2,
    tierTikwm,
  } = await import(tiktokCoverModulePath);

  // ==========================================
  // MODE 1: PROBE SINGLE ID / URL
  // ==========================================
  if (probeArg) {
    console.log(`\n=== PROBE TIKTOK EXTRACTION: ${probeArg} ===`);
    let cleanId = '';
    let probeUrl = '';

    if (/^\d{8,25}$/.test(probeArg)) {
      cleanId = probeArg;
      probeUrl = `https://www.tiktok.com/@tiktok/video/${cleanId}`;
    } else {
      const match = probeArg.match(/\/video\/(\d{8,25})/);
      cleanId = match ? match[1] : '';
      probeUrl = probeArg;
    }

    const canonical = getCanonicalTikTokUrl(cleanId, probeUrl);
    console.log(`Canonical URL: ${canonical}`);
    console.log(`TikTok ID:     ${cleanId}\n`);

    const allTiers = [
      { name: 'rehydration', fn: () => tierRehydration(canonical, 8000) },
      { name: 'meta',        fn: () => tierMeta(canonical, 8000) },
      { name: 'oembed',      fn: () => tierOembed(canonical, cleanId, 8000) },
      { name: 'embedv2',    fn: () => tierEmbedV2(cleanId, 8000) },
      { name: 'tikwm',       fn: () => tierTikwm(canonical, 10000) },
    ];

    console.log('| Tier | HTTP | Kunci Ditemukan | Host Kandidat | Sniff | Bytes | Verdict |');
    console.log('|---|---|---|---|---|---|---|');

    for (const t of allTiers) {
      try {
        const res = await t.fn();
        const http = res.status || 0;
        const keys = (res.keysFound || []).join(',') || '-';
        let host = '-';
        if (res.sourceUrl) {
          try { host = new URL(res.sourceUrl).hostname; } catch {}
        }
        const sniff = res.ext || '-';
        const bytes = res.buffer ? res.buffer.length : 0;
        const verdict = res.ok ? '✓ OK' : `✗ FAIL (${res.reason || '-'})`;

        console.log(`| ${t.name.padEnd(11)} | ${String(http).padEnd(4)} | ${keys.padEnd(15)} | ${host.padEnd(20)} | ${sniff.padEnd(5)} | ${String(bytes).padEnd(6)} | ${verdict} |`);
      } catch (err) {
        console.log(`| ${t.name.padEnd(11)} | 0    | -               | -                    | -     | 0      | ✗ ERROR (${err.message}) |`);
      }
    }
    console.log('\nProbe selesai. Tidak ada data yang diubah.\n');
    process.exit(0);
  }

  await ensureBucket('portfolio-covers');

  // ==========================================
  // MODE 2: --from-dir (MANUAL COVERS / FFMPEG)
  // ==========================================
  if (fromDirArg) {
    const dirPath = path.resolve(process.cwd(), fromDirArg);
    if (!fs.existsSync(dirPath)) {
      console.error(`❌ Direktori tidak ditemukan: ${dirPath}`);
      process.exit(1);
    }

    console.log(`\n=== IMPORT COVERS MANUAL DARI DIREKTORI: ${dirPath} ===\n`);
    const files = fs.readdirSync(dirPath);
    let manualOk = 0;
    let manualFail = 0;

    for (const f of files) {
      const match = f.match(/^(\d{8,25})\.(jpg|jpeg|png|webp|mp4)$/i);
      if (!match) continue;

      const tiktokId = match[1];
      const rawExt = match[2].toLowerCase();
      const filePath = path.join(dirPath, f);

      process.stdout.write(`Memproses ${f}... `);

      let imageBuffer = null;
      let contentType = 'image/jpeg';
      let ext = 'jpg';

      if (rawExt === 'mp4') {
        const tmpJpg = path.join(dirPath, `__tmp_${tiktokId}.jpg`);
        const ffmpegRes = spawnSync('ffmpeg', [
          '-y',
          '-ss',
          '0.5',
          '-i',
          filePath,
          '-frames:v',
          '1',
          '-vf',
          'scale=720:-2',
          '-q:v',
          '3',
          tmpJpg,
        ]);

        if (ffmpegRes.status === 0 && fs.existsSync(tmpJpg)) {
          imageBuffer = fs.readFileSync(tmpJpg);
          fs.unlinkSync(tmpJpg);
        } else {
          console.log(`✗ FFmpeg gagal mengekstrak frame dari ${f}`);
          manualFail++;
          continue;
        }
      } else {
        imageBuffer = fs.readFileSync(filePath);
      }

      const sniff = sniffLocalImage(imageBuffer);
      if (!sniff) {
        console.log(`✗ File bukan format gambar yang valid`);
        manualFail++;
        continue;
      }

      contentType = sniff.contentType;
      ext = sniff.ext;

      const storagePath = `covers/tiktok-${tiktokId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('portfolio-covers')
        .upload(storagePath, imageBuffer, {
          upsert: true,
          contentType,
          cacheControl: '86400',
        });

      if (upErr) {
        console.log(`✗ Upload gagal: ${upErr.message}`);
        manualFail++;
        continue;
      }

      const { data: updateData, error: dbErr } = await supabase
        .from('portfolio_videos')
        .update({ thumbnail_path: storagePath })
        .like('file_path', `%${tiktokId}%`)
        .select('id');

      if (dbErr || !updateData || updateData.length === 0) {
        console.log(`⚠️ Gambar terupload ke storage (${storagePath}), tapi ID tidak ditemukan di DB`);
        manualOk++;
      } else {
        console.log(`✓ Sukses dipersist (${storagePath}) untuk ${updateData.length} baris DB`);
        manualOk++;
      }
    }

    console.log(`\nImport manual selesai: ${manualOk} berhasil, ${manualFail} gagal.\n`);
    process.exit(manualFail > 0 ? 1 : 0);
  }

  // ==========================================
  // MODE 3: MAIN BACKFILL PIPELINE
  // ==========================================
  console.log('--- BACKFILL TIKTOK COVERS KE SUPABASE STORAGE ---');
  if (dryRun) console.log('[MODE DRY RUN: Tidak ada penulisan data ke storage atau database]');

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

  const activeTiers = tiersArg ? tiersArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  const candidateTargets = (rows || [])
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
    .filter(Boolean);

  console.log(`Total video TikTok di database: ${candidateTargets.length}`);

  const targets = [];
  for (const t of candidateTargets) {
    if (force) {
      targets.push(t);
      continue;
    }
    if (!t.thumb || isTikTokCdn(t.thumb) || !t.thumb.startsWith('covers/')) {
      targets.push(t);
      continue;
    }
    if (verify && t.thumb.startsWith('covers/')) {
      const { data: pubData } = supabase.storage.from('portfolio-covers').getPublicUrl(t.thumb);
      const isOk = await checkUrlHead200(pubData.publicUrl);
      if (!isOk) {
        targets.push(t);
      }
    }
  }

  console.log(`Target yang perlu diproses/diperbarui: ${targets.length}\n`);

  let ok = 0;
  let fail = 0;
  const tierCounts = {};
  const failedItems = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] "${t.title}" (ID: ${t.tiktokId})... `);

    const r = await fetchTikTokCover(t.tiktokId, t.url, {
      tiers: activeTiers || ['rehydration', 'meta', 'oembed', 'embedv2', 'tikwm'],
      allowThirdParty: true,
      deadlineMs: 20000,
    });

    if (!r.ok || !r.buffer) {
      const attemptSummary = (r.attempts || []).map((a) => `${a.tier}:${a.reason}`).join(', ');
      console.log(`✗ Gagal: attempts=[${attemptSummary}]`);
      fail++;
      failedItems.push({
        id: t.tiktokId,
        title: t.title,
        url: t.url,
        attempts: r.attempts || [],
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      continue;
    }

    const storagePath = `covers/tiktok-${t.tiktokId}.${r.ext}`;
    tierCounts[r.tier] = (tierCounts[r.tier] || 0) + 1;

    if (dryRun) {
      console.log(`✓ [DRY-RUN OK] tier=${r.tier} bytes=${r.buffer.length} -> ${storagePath}`);
      ok++;
      await new Promise((resolve) => setTimeout(resolve, 400));
      continue;
    }

    const { error: upErr } = await supabase.storage
      .from('portfolio-covers')
      .upload(storagePath, r.buffer, {
        upsert: true,
        contentType: r.contentType,
        cacheControl: '86400',
      });

    if (upErr) {
      console.log(`✗ Upload storage gagal: ${upErr.message}`);
      fail++;
      failedItems.push({
        id: t.tiktokId,
        title: t.title,
        url: t.url,
        error: upErr.message,
      });
      await new Promise((resolve) => setTimeout(resolve, 400));
      continue;
    }

    const { data: pubData } = supabase.storage.from('portfolio-covers').getPublicUrl(storagePath);
    const headOk = await checkUrlHead200(pubData.publicUrl);
    if (!headOk) {
      console.warn(`⚠️ Warning: HEAD publicUrl non-200 (${pubData.publicUrl})`);
    }

    const { data: upDbData, error: upDbErr } = await supabase
      .from('portfolio_videos')
      .update({ thumbnail_path: storagePath })
      .eq('id', t.rowId)
      .select('id');

    if (upDbErr || !upDbData || upDbData.length !== 1) {
      console.log(`✗ Gagal update DB row (${upDbErr?.message || 'row not found'})`);
      fail++;
      failedItems.push({
        id: t.tiktokId,
        title: t.title,
        url: t.url,
        error: upDbErr?.message || 'DB update failed',
      });
    } else {
      console.log(`✓ ${t.tiktokId} tier=${r.tier} bytes=${r.buffer.length}`);
      ok++;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  if (failedItems.length > 0) {
    const failedPath = path.resolve(process.cwd(), 'covers-failed.json');
    fs.writeFileSync(failedPath, JSON.stringify(failedItems, null, 2));
    console.log(`\n⚠️ ${failedItems.length} item gagal dicatat ke ${failedPath}`);
  }

  console.log('\n======================================================');
  console.log(`Ringkasan: ${ok} sukses, ${fail} gagal dari ${targets.length} target.`);
  console.log('Statistik Tier Sukses:', JSON.stringify(tierCounts));
  console.log('======================================================\n');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
