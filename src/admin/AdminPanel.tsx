import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Film,
  LoaderCircle,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
  Video,
  Link2,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { deletePortfolioVideo, uploadPortfolioVideo } from '../lib/portfolioUpload';
import { processVideo } from '../lib/videoProcessor';
import {
  decodeExternalVideo,
  encodeExternalVideo,
  getExternalVideoInfo,
  type ExternalVideoSource,
} from '../lib/externalVideo';

const categories = [
  'TikTok Content',
  'Product Video',
  'Food & Beverage',
  'Brand Content',
  'Lifestyle',
  'Promotional Video',
];

type VideoRecord = {
  id: string;
  title: string;
  client: string | null;
  category: string;
  description: string | null;
  role: string | null;
  aspect_ratio: '9:16' | '16:9' | '1:1';
  file_path: string;
  preview_path: string | null;
  thumbnail_path: string | null;
  published: boolean;
  created_at: string;
  display_order: number;
};

const ADMIN_UID = 'a9009276-3516-466c-8a56-43ddb2d9b04a';

async function fetchTikTokThumbnailDirect(url: string, id: string): Promise<string> {
  const candidates = [
    url.trim(),
    id ? `https://www.tiktok.com/@tiktok/video/${id.trim()}` : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(candidate)}`
      );
      if (res.ok) {
        const data = (await res.json()) as { thumbnail_url?: string };
        if (data?.thumbnail_url) return data.thumbnail_url;
      }
    } catch {
      // coba kandidat berikutnya
    }
  }
  return '';
}

export default function AdminPanel() {
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [records, setRecords] = useState<VideoRecord[]>([]);
  const [orderDirty, setOrderDirty] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [syncingThumbs, setSyncingThumbs] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
  const [source, setSource] = useState<'upload' | ExternalVideoSource>('upload');
  const [sourceUrl, setSourceUrl] = useState('');
  const [customThumbnailUrl, setCustomThumbnailUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [processingVideo, setProcessingVideo] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('portfolio_videos')
      .select(
        'id, title, client, category, description, role, aspect_ratio, file_path, preview_path, thumbnail_path, published, created_at, display_order'
      )
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (queryError) throw new Error(queryError.message);
    setRecords((data ?? []) as VideoRecord[]);
    setOrderDirty(false);
  }, []);

  useEffect(() => {
    let alive = true;
    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      const user = data.session?.user;
      setIsAdmin(user?.id === ADMIN_UID);
      setSessionReady(true);
      if (user?.id === ADMIN_UID) {
        try {
          await refresh();
        } catch (err) {
          if (alive) {
            setError(
              err instanceof Error ? err.message : 'Gagal memuat daftar video.'
            );
          }
        }
      }
    }
    void checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIsAdmin(user?.id === ADMIN_UID);
      if (user?.id === ADMIN_UID) {
        window.setTimeout(() => {
          void refresh().catch((err: unknown) =>
            setError(
              err instanceof Error ? err.message : 'Gagal memuat daftar video.'
            )
          );
        }, 0);
      } else {
        setRecords([]);
      }
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [refresh]);

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    },
    [previewUrl, thumbnailUrl]
  );

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) throw loginError;
      if (data.user?.id !== ADMIN_UID) {
        await supabase.auth.signOut();
        throw new Error('Akun ini tidak memiliki akses admin.');
      }
      setIsAdmin(true);
      setPassword('');
      await refresh();
      setNotice('Login berhasil.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(logoutError.message);
      return;
    }
    setIsAdmin(false);
    setRecords([]);
    setNotice('Kamu sudah logout.');
  }

  async function handleOriginalSelected(selected: File | null) {
    setError('');
    setNotice('');
    setFile(selected);
    setPreviewFile(null);
    setThumbnailFile(null);
    setProcessingProgress(0);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setPreviewUrl('');
    setThumbnailUrl('');
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.mp4')) {
      setFile(null);
      setError('Pilih video dengan format MP4.');
      return;
    }
    if (selected.size > 50 * 1024 * 1024) {
      setFile(null);
      setError('Ukuran video asli maksimal 50 MB.');
      return;
    }
    setProcessingVideo(true);
    setNotice(
      'Menyiapkan pemroses video. Proses pertama mungkin memerlukan waktu untuk mengunduh FFmpeg.'
    );
    try {
      const result = await processVideo(selected, setProcessingProgress);
      setPreviewFile(result.preview);
      setThumbnailFile(result.thumbnail);
      setPreviewUrl(URL.createObjectURL(result.preview));
      setThumbnailUrl(URL.createObjectURL(result.thumbnail));
      setNotice('Preview dan thumbnail berhasil dibuat. Periksa hasilnya sebelum upload.');
    } catch (err) {
      console.error('[Video Processor]', err);
      setPreviewFile(null);
      setThumbnailFile(null);
      setError(
        `Gagal memproses video — ${
          err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        }`
      );
      setNotice('');
    } finally {
      setProcessingVideo(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setClient('');
    setCategory(categories[0]);
    setDescription('');
    setRole('');
    setAspectRatio('9:16');
    setSource('upload');
    setSourceUrl('');
    setCustomThumbnailUrl('');
    setFile(null);
    setPreviewFile(null);
    setThumbnailFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setPreviewUrl('');
    setThumbnailUrl('');
    setProcessingProgress(0);
    setPublished(true);
    const input = document.getElementById(
      'portfolio-video-file'
    ) as HTMLInputElement | null;
    if (input) input.value = '';
  }

  function startEdit(record: VideoRecord) {
    setError('');
    setEditingId(record.id);
    setTitle(record.title);
    setClient(record.client ?? '');
    setCategory(
      categories.includes(record.category) ? record.category : categories[0]
    );
    setDescription(record.description ?? '');
    setRole(record.role ?? '');
    setAspectRatio(record.aspect_ratio || '9:16');
    setPublished(record.published);
    setCustomThumbnailUrl(record.thumbnail_path ?? '');
    setFile(null);
    setPreviewFile(null);
    setThumbnailFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    setPreviewUrl('');
    setThumbnailUrl('');

    const external = decodeExternalVideo(record.file_path);
    if (external) {
      setSource(external.source);
      setSourceUrl(external.url);
    } else {
      setSource('upload');
      setSourceUrl('');
    }

    setNotice(
      `Mode Edit aktif untuk "${record.title}". Anda dapat memperbarui informasi atau thumbnail, lalu klik SIMPAN PERUBAHAN.`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Sinkronisasi otomatis thumbnail TikTok untuk semua karya yang belum memiliki thumbnail
  async function syncAllTikTokThumbnails() {
    setError('');
    setNotice('');
    setSyncingThumbs(true);

    let updatedCount = 0;
    try {
      for (const record of records) {
        const external = decodeExternalVideo(record.file_path);
        if (external && external.source === 'tiktok' && !record.thumbnail_path) {
          const info = getExternalVideoInfo(external.url);
          const thumb = await fetchTikTokThumbnailDirect(external.url, info.id);
          if (thumb) {
            const { error: upErr } = await supabase
              .from('portfolio_videos')
              .update({ thumbnail_path: thumb })
              .eq('id', record.id);
            if (!upErr) updatedCount += 1;
          }
        }
      }
      await refresh();
      setNotice(
        updatedCount > 0
          ? `Berhasil memperbarui ${updatedCount} thumbnail video TikTok!`
          : 'Semua video TikTok sudah memiliki thumbnail.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Terjadi kendala saat menyinkronkan thumbnail.'
      );
    } finally {
      setSyncingThumbs(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (processingVideo) {
      setError('Tunggu sampai pemrosesan video selesai.');
      return;
    }

    // Mode Edit Karya yang Sudah Ada
    if (editingId) {
      let externalInfo: ReturnType<typeof getExternalVideoInfo> | null = null;
      if (source !== 'upload') {
        try {
          externalInfo = getExternalVideoInfo(sourceUrl);
          if (externalInfo.source !== source) {
            throw new Error(
              `Link yang dimasukkan bukan link ${
                source === 'youtube' ? 'YouTube' : 'TikTok'
              }.`
            );
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Link video tidak valid.');
          return;
        }
      }

      setSaving(true);
      try {
        const updatePayload: Record<string, unknown> = {
          title: title.trim(),
          client: client.trim() || null,
          category,
          description: description.trim() || null,
          role: role.trim() || null,
          published,
          aspect_ratio: aspectRatio,
        };

        if (customThumbnailUrl.trim()) {
          updatePayload.thumbnail_path = customThumbnailUrl.trim();
        }

        if (source !== 'upload' && externalInfo) {
          updatePayload.file_path = encodeExternalVideo(
            source as ExternalVideoSource,
            sourceUrl
          );
          updatePayload.preview_path = null;
          if (!customThumbnailUrl.trim()) {
            if (externalInfo.thumbnail) {
              updatePayload.thumbnail_path = externalInfo.thumbnail;
            } else if (source === 'tiktok') {
              const fetched = await fetchTikTokThumbnailDirect(
                sourceUrl,
                externalInfo.id
              );
              if (fetched) updatePayload.thumbnail_path = fetched;
            }
          }
        }

        const { error: updateError } = await supabase
          .from('portfolio_videos')
          .update(updatePayload)
          .eq('id', editingId);

        if (updateError) {
          throw new Error(`Gagal memperbarui karya: ${updateError.message}`);
        }

        resetForm();
        await refresh();
        setNotice('Perubahan karya berhasil disimpan.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memperbarui karya.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Mode Tambah Karya Baru
    if (source === 'upload' && (!file || !previewFile || !thumbnailFile)) {
      setError('Pilih file MP4 dan tunggu pemrosesan preview selesai.');
      return;
    }
    let externalInfo: ReturnType<typeof getExternalVideoInfo> | null = null;
    if (source !== 'upload') {
      try {
        externalInfo = getExternalVideoInfo(sourceUrl);
        if (externalInfo.source !== source) {
          throw new Error(
            `Link yang dimasukkan bukan link ${
              source === 'youtube' ? 'YouTube' : 'TikTok'
            }.`
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Link video tidak valid.');
        return;
      }
    }
    setSaving(true);
    try {
      if (source === 'upload' && file && previewFile && thumbnailFile) {
        await uploadPortfolioVideo(
          file,
          {
            title,
            client,
            category,
            description,
            role,
            published,
            aspectRatio,
            displayOrder: records.length,
          },
          previewFile,
          thumbnailFile
        );
      } else if (externalInfo) {
        let thumbToSave = customThumbnailUrl.trim() || externalInfo.thumbnail || null;
        if (!thumbToSave && source === 'tiktok') {
          thumbToSave = await fetchTikTokThumbnailDirect(sourceUrl, externalInfo.id);
        }

        const { error: insertError } = await supabase
          .from('portfolio_videos')
          .insert({
            title: title.trim(),
            client: client.trim() || null,
            category,
            description: description.trim() || null,
            role: role.trim() || null,
            file_path: encodeExternalVideo(
              source as ExternalVideoSource,
              sourceUrl
            ),
            preview_path: null,
            thumbnail_path: thumbToSave || null,
            published,
            aspect_ratio: aspectRatio,
            display_order: records.length,
          });
        if (insertError) {
          throw new Error(`Link video gagal disimpan: ${insertError.message}`);
        }
      }
      resetForm();
      await refresh();
      setNotice(
        published
          ? 'Karya berhasil disimpan dan dipublikasikan.'
          : 'Karya berhasil disimpan sebagai draft.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan karya.');
    } finally {
      setSaving(false);
    }
  }

  function moveRecord(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= records.length) return;
    setRecords((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setOrderDirty(true);
    setNotice(
      'Urutan berubah. Klik SIMPAN URUTAN untuk menerapkannya ke website.'
    );
  }

  async function saveOrder() {
    setSavingOrder(true);
    setError('');
    setNotice('');
    try {
      for (let index = 0; index < records.length; index += 1) {
        const { error: updateError } = await supabase
          .from('portfolio_videos')
          .update({ display_order: index })
          .eq('id', records[index].id);
        if (updateError) {
          throw new Error(
            `Gagal menyimpan urutan video "${records[index].title}": ${updateError.message}`
          );
        }
      }
      setRecords((current) =>
        current.map((record, index) => ({ ...record, display_order: index }))
      );
      setOrderDirty(false);
      setNotice('Urutan portofolio berhasil disimpan.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menyimpan urutan video.'
      );
    } finally {
      setSavingOrder(false);
    }
  }

  async function remove(record: VideoRecord) {
    if (!window.confirm(`Hapus video "${record.title}" secara permanen?`)) return;
    setError('');
    setNotice('');
    try {
      await deletePortfolioVideo(
        record.id,
        record.file_path,
        record.preview_path,
        record.thumbnail_path
      );
      if (editingId === record.id) resetForm();
      await refresh();
      setNotice('Video berhasil dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus video.');
    }
  }

  if (!sessionReady) {
    return (
      <main className="admin-page">
        <div className="admin-content">Memeriksa sesi admin...</div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a className="admin-brand" href="/">
          <span className="admin-brand-mark">V.</span>
          <span>
            CREATOR PORTFOLIO<small>CONTENT MANAGEMENT</small>
          </span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {isAdmin && (
            <button
              type="button"
              className="admin-back"
              onClick={() => void logout()}
            >
              <LogOut size={16} /> LOGOUT
            </button>
          )}
          <a className="admin-back" href="/">
            <ArrowLeft size={16} /> LIHAT PORTOFOLIO
          </a>
        </div>
      </header>

      <div className="admin-content">
        {!isAdmin ? (
          <section
            className="admin-form"
            style={{ maxWidth: 520, margin: '50px auto' }}
          >
            <div className="admin-heading">
              <div>
                <span className="admin-eyebrow">
                  <span /> ADMIN LOGIN
                </span>
                <h1>
                  YOUR WORK.
                  <br />
                  <span>YOUR CONTROL.</span>
                </h1>
                <p>Login menggunakan akun admin Supabase yang sudah dibuat.</p>
              </div>
            </div>
            {error && (
              <div className="admin-alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="admin-alert success" role="status">
                <CheckCircle2 size={17} />
                {notice}
              </div>
            )}
            <form onSubmit={login}>
              <label className="admin-label">
                EMAIL ADMIN
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="admin-label">
                PASSWORD
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button className="admin-submit" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <LoaderCircle className="spin" size={17} /> MEMERIKSA...
                  </>
                ) : (
                  <>
                    <LogIn size={17} /> LOGIN ADMIN
                  </>
                )}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <span className="admin-eyebrow">
                  <span /> ADMIN WORKSPACE
                </span>
                <h1>
                  {editingId ? 'EDIT YOUR' : 'ADD YOUR'}
                  <br />
                  <span>VIDEO WORK.</span>
                </h1>
                <p>
                  Kelola karya dari upload MP4, TikTok, maupun YouTube. Urutan 01–09
                  otomatis tampil sebagai 9 preview utama di beranda.
                </p>
              </div>
              <div className="admin-count">
                <Film size={20} />
                <strong>{records.length.toString().padStart(2, '0')}</strong>
                <span>VIDEO TERSIMPAN</span>
              </div>
            </div>

            {error && (
              <div className="admin-alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="admin-alert success" role="status">
                <CheckCircle2 size={17} />
                {notice}
              </div>
            )}

            <div className="admin-layout">
              <form className="admin-form" onSubmit={submit}>
                <div className="admin-form-title">
                  <span className="admin-step">01</span>
                  <div style={{ flex: 1 }}>
                    <h2>
                      {editingId ? 'EDIT DETAIL KARYA' : 'DETAIL KARYA'}
                    </h2>
                    <p>
                      {editingId
                        ? 'Perbarui judul, klien, deskripsi, thumbnail, atau link karya.'
                        : 'Informasi yang tampil di galeri dan mode preview.'}
                    </p>
                  </div>
                  {editingId && (
                    <button
                      type="button"
                      className="admin-cancel-edit"
                      onClick={resetForm}
                    >
                      <X size={14} /> BATAL EDIT
                    </button>
                  )}
                </div>

                <label className="admin-label">
                  JUDUL VIDEO
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Menu Andalan Bakmi Jowo"
                    maxLength={90}
                    required
                  />
                </label>

                <div className="admin-two-col">
                  <label className="admin-label">
                    BRAND / KLIEN
                    <input
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                      placeholder="Nama brand (opsional)"
                      maxLength={80}
                    />
                  </label>
                  <label className="admin-label">
                    KATEGORI
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="admin-label">
                  DESKRIPSI
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ceritakan konsep video..."
                    rows={3}
                    maxLength={400}
                  />
                </label>

                <label className="admin-label">
                  KONTRIBUSI KAMU
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Contoh: Ide, shooting, editing"
                    maxLength={150}
                  />
                </label>

                <label className="admin-label">
                  RASIO VIDEO
                  <select
                    value={aspectRatio}
                    onChange={(e) =>
                      setAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')
                    }
                  >
                    <option value="9:16">Vertikal — 9:16</option>
                    <option value="16:9">Horizontal — 16:9</option>
                    <option value="1:1">Kotak — 1:1</option>
                  </select>
                </label>

                <div className="admin-form-title upload-title">
                  <span className="admin-step">02</span>
                  <div>
                    <h2>SUMBER VIDEO</h2>
                    <p>
                      Pilih cara menampilkan karya. Link tidak mengunggah file video ke Storage.
                    </p>
                  </div>
                </div>

                <div
                  className="source-choice"
                  role="group"
                  aria-label="Sumber video"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                    gap: 8,
                    marginBottom: 18,
                  }}
                >
                  {(['upload', 'tiktok', 'youtube'] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSource(item);
                        setError('');
                      }}
                      aria-pressed={source === item}
                      style={{
                        padding: '12px 8px',
                        border:
                          source === item
                            ? '1px solid #25F4EE'
                            : '1px solid rgba(255,255,255,.18)',
                        borderRadius: 8,
                        background:
                          source === item
                            ? 'rgba(37,244,238,.10)'
                            : 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {item === 'upload' ? 'UPLOAD MP4' : item.toUpperCase()}
                    </button>
                  ))}
                </div>

                {source === 'upload' ? (
                  editingId ? (
                    <div className="admin-label">
                      <small className="admin-help">
                        File video MP4 yang sudah ter-upload tetap dipertahankan. Anda cukup
                        mengubah informasi teks di atas lalu klik <strong>SIMPAN PERUBAHAN</strong>.
                      </small>
                    </div>
                  ) : (
                    <>
                      <label className="admin-label">
                        PILIH FILE MP4
                        <input
                          id="portfolio-video-file"
                          type="file"
                          accept="video/mp4,.mp4"
                          required
                          onChange={(e) =>
                            void handleOriginalSelected(e.target.files?.[0] ?? null)
                          }
                        />
                        <small className="admin-help">
                          {file
                            ? `${file.name} — ${(file.size / (1024 * 1024)).toFixed(1)} MB`
                            : 'MP4 maksimal 50 MB. File akan diproses menjadi preview lebih ringan.'}
                        </small>
                      </label>
                      <div className="admin-label">
                        <strong>PEMROSESAN OTOMATIS</strong>
                        <small className="admin-help">
                          Preview MP4 dan thumbnail JPG dibuat otomatis di browser. Biarkan tab
                          ini terbuka selama proses berlangsung.
                        </small>
                        {processingVideo && (
                          <div role="status" aria-live="polite">
                            <LoaderCircle className="spin" size={17} /> MEMPROSES VIDEO...{' '}
                            {processingProgress}%
                            <progress
                              value={processingProgress}
                              max={100}
                              style={{ width: '100%' }}
                            />
                          </div>
                        )}
                        {previewUrl && (
                          <div style={{ marginTop: 12 }}>
                            <p>PREVIEW VIDEO</p>
                            <video
                              src={previewUrl}
                              controls
                              muted
                              playsInline
                              style={{
                                width: '100%',
                                maxHeight: 360,
                                background: '#000',
                                borderRadius: 8,
                              }}
                            />
                            {previewFile && (
                              <small className="admin-help">
                                Ukuran preview: {(previewFile.size / (1024 * 1024)).toFixed(2)} MB
                              </small>
                            )}
                          </div>
                        )}
                        {thumbnailUrl && (
                          <div style={{ marginTop: 12 }}>
                            <p>THUMBNAIL OTOMATIS</p>
                            <img
                              src={thumbnailUrl}
                              alt="Thumbnail hasil pemrosesan"
                              style={{ width: '100%', maxWidth: 240, borderRadius: 8 }}
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <label className="admin-label">
                      LINK VIDEO {source.toUpperCase()}
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        placeholder={
                          source === 'youtube'
                            ? 'https://www.youtube.com/watch?v=...'
                            : 'https://www.tiktok.com/@.../video/...'
                        }
                        required
                      />
                    </label>
                    <div className="admin-label">
                      <small className="admin-help">
                        {source === 'youtube'
                          ? 'Gunakan visibilitas Unlisted (Tidak Publik), bukan Private, agar video dapat diputar oleh pengunjung portofolio.'
                          : 'Pastikan video TikTok dapat diakses publik dan tidak dibatasi.'}
                      </small>
                      {sourceUrl.trim() && (
                        <div style={{ marginTop: 10 }}>
                          {(() => {
                            try {
                              const info = getExternalVideoInfo(sourceUrl);
                              return info.source === source ? (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'center',
                                  }}
                                >
                                  {info.thumbnail ? (
                                    <img
                                      src={info.thumbnail}
                                      alt="Thumbnail video"
                                      style={{ width: 100, borderRadius: 6 }}
                                    />
                                  ) : (
                                    <Link2 size={24} />
                                  )}
                                  <small className="admin-help">
                                    Link {source} terdeteksi dan siap disimpan.
                                  </small>
                                </div>
                              ) : (
                                <small className="admin-help">
                                  Pilih link {source} yang sesuai.
                                </small>
                              );
                            } catch {
                              return (
                                <small className="admin-help">
                                  Masukkan link {source} yang valid.
                                </small>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Input Opsional: URL Thumbnail Custom / Langsung */}
                <label className="admin-label" style={{ marginTop: 12 }}>
                  URL THUMBNAIL (OPSIONAL / OVERRIDE)
                  <input
                    type="url"
                    value={customThumbnailUrl}
                    onChange={(e) => setCustomThumbnailUrl(e.target.value)}
                    placeholder="https://... (isi jika thumbnail belum muncul otomatis)"
                  />
                  <small className="admin-help">
                    Bisa diisi URL gambar langsung jika thumbnail TikTok otomatis gagal termuat.
                  </small>
                </label>

                <label className="admin-publish">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                  />
                  <span className="admin-checkmark" />
                  <span>
                    <strong>Publikasikan di galeri</strong>
                    <small>Matikan untuk menyimpan sebagai draft.</small>
                  </span>
                </label>

                <button
                  className="admin-submit"
                  type="submit"
                  disabled={
                    saving ||
                    processingVideo ||
                    (!editingId &&
                      source === 'upload' &&
                      (!file || !previewFile || !thumbnailFile)) ||
                    (source !== 'upload' && !sourceUrl.trim())
                  }
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> MENYIMPAN...
                    </>
                  ) : editingId ? (
                    <>
                      <Save size={18} /> SIMPAN PERUBAHAN
                    </>
                  ) : (
                    <>
                      <Plus size={18} /> SIMPAN KARYA
                    </>
                  )}
                </button>
              </form>

              <aside className="admin-library">
                <div className="admin-library-heading">
                  <div>
                    <span className="admin-step">03</span>
                    <h2>URUTAN & EDIT KARYA</h2>
                  </div>
                  <span>{records.length} ITEM</span>
                </div>
                <p className="admin-order-help">
                  Urutan <strong>01 s/d 09 (TOP 9)</strong> otomatis tampil di halaman utama
                  sebelum pengunjung menekan tombol <em>Lihat Semua Karya</em>. Klik ikon pensil
                  untuk mengedit teks karya.
                </p>

                {/* Tombol Sinkronisasi Cepat Thumbnail TikTok */}
                <button
                  type="button"
                  className="admin-sync-thumbs-btn"
                  onClick={() => void syncAllTikTokThumbnails()}
                  disabled={syncingThumbs || records.length === 0}
                  title="Ambil dan simpan otomatis gambar cover untuk semua video TikTok"
                >
                  {syncingThumbs ? (
                    <>
                      <LoaderCircle className="spin" size={14} /> MENYINKRONKAN THUMBNAIL...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} /> SINKRONKAN THUMBNAIL TIKTOK OTOMATIS
                    </>
                  )}
                </button>

                {orderDirty && (
                  <button
                    type="button"
                    className="admin-save-order"
                    onClick={() => void saveOrder()}
                    disabled={savingOrder}
                  >
                    {savingOrder ? (
                      <>
                        <LoaderCircle className="spin" size={15} /> MENYIMPAN URUTAN...
                      </>
                    ) : (
                      <>
                        <Save size={15} /> SIMPAN URUTAN
                      </>
                    )}
                  </button>
                )}

                {records.length === 0 ? (
                  <div className="admin-empty">
                    <Video size={25} />
                    <strong>Belum ada video</strong>
                    <p>Karya yang ditambahkan akan muncul di sini.</p>
                  </div>
                ) : (
                  <div className="admin-records">
                    {records.map((record, index) => (
                      <article
                        className={
                          editingId === record.id
                            ? 'admin-record is-editing'
                            : 'admin-record'
                        }
                        key={record.id}
                      >
                        <div className="admin-order-number">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="admin-record-thumb">
                          {record.thumbnail_path ? (
                            <img
                              src={record.thumbnail_path}
                              alt={record.title}
                              referrerPolicy="no-referrer"
                            />
                          ) : record.file_path.startsWith('external:') ? (
                            <Link2 size={21} />
                          ) : (
                            <Video size={21} />
                          )}
                          <span>{record.published ? 'PUBLISHED' : 'DRAFT'}</span>
                        </div>
                        <div className="admin-record-info">
                          <div className="admin-record-title-row">
                            <strong>{record.title}</strong>
                            {index < 9 && record.published && (
                              <span className="admin-top9-badge">TOP 9</span>
                            )}
                          </div>
                          <small>{record.client || record.category}</small>
                          <small>
                            {record.file_path.startsWith('external:')
                              ? record.file_path.startsWith('external:youtube:')
                                ? 'YOUTUBE LINK'
                                : 'TIKTOK LINK'
                              : 'UPLOAD MP4'}{' '}
                            · {new Date(record.created_at).toLocaleDateString('id-ID')}
                          </small>
                        </div>
                        <div className="admin-record-actions">
                          <button
                            type="button"
                            className="admin-order-button"
                            onClick={() => startEdit(record)}
                            disabled={savingOrder}
                            aria-label={`Edit ${record.title}`}
                            title="Edit detail karya"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="admin-order-button"
                            onClick={() => moveRecord(index, -1)}
                            disabled={index === 0 || savingOrder}
                            aria-label={`Naikkan ${record.title}`}
                            title="Pindah ke atas"
                          >
                            <ChevronUp size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveRecord(index, 1)}
                            className="admin-order-button"
                            disabled={index === records.length - 1 || savingOrder}
                            aria-label={`Turunkan ${record.title}`}
                            title="Pindah ke bawah"
                          >
                            <ChevronDown size={17} />
                          </button>
                          <button
                            type="button"
                            className="admin-delete"
                            onClick={() => void remove(record)}
                            aria-label={`Hapus ${record.title}`}
                            title="Hapus video"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <a className="admin-preview-link" href="/">
                  BUKA HALAMAN PORTOFOLIO <ArrowLeft size={14} />
                </a>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
