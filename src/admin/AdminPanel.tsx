import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Film, LoaderCircle, LogIn, LogOut,
  Plus, Trash2, Video
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { deletePortfolioVideo, uploadPortfolioVideo } from '../lib/portfolioUpload';
import { processVideo } from '../lib/videoProcessor';

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
  file_path: string;
  preview_path: string | null;
  thumbnail_path: string | null;
  published: boolean;
  created_at: string;
};

const ADMIN_UID = 'a9009276-3516-466c-8a56-43ddb2d9b04a';

export default function AdminPanel() {
  const [sessionReady, setSessionReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [records, setRecords] = useState<VideoRecord[]>([]);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
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
      .select('id, title, client, category, file_path, preview_path, thumbnail_path, published, created_at')
      .order('created_at', { ascending: false });

    if (queryError) throw new Error(queryError.message);
    setRecords((data ?? []) as VideoRecord[]);
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
          if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat daftar video.');
        }
      }
    }

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setIsAdmin(user?.id === ADMIN_UID);
      if (user?.id === ADMIN_UID) {
        window.setTimeout(() => {
          void refresh().catch((err: unknown) => {
            setError(err instanceof Error ? err.message : 'Gagal memuat daftar video.');
          });
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
    setError('');
    const { error: logoutError } = await supabase.auth.signOut();
    if (logoutError) {
      setError(logoutError.message);
      return;
    }
    setIsAdmin(false);
    setRecords([]);
    setNotice('Kamu sudah logout.');
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [previewUrl, thumbnailUrl]);

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
    setNotice('Menyiapkan pemroses video. Proses pertama mungkin memerlukan waktu untuk mengunduh FFmpeg.');

    try {
      const result = await processVideo(selected, setProcessingProgress);
      setPreviewFile(result.preview);
      setThumbnailFile(result.thumbnail);
      setPreviewUrl(URL.createObjectURL(result.preview));
      setThumbnailUrl(URL.createObjectURL(result.thumbnail));
      setNotice('Preview dan thumbnail berhasil dibuat. Periksa hasilnya sebelum upload.');
    } catch (err) {
      console.error('[Video Processor] Gagal memproses video:', err);
      setPreviewFile(null);
      setThumbnailFile(null);

      const detail = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);

      setError(`Gagal memproses video — ${detail}`);
      setNotice('');
    } finally {
      setProcessingVideo(false);
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

    if (!file) {
      setError('Pilih file video MP4 terlebih dahulu.');
      return;
    }

    if (!previewFile || !thumbnailFile) {
      setError('Preview dan thumbnail belum tersedia. Pilih ulang video untuk memprosesnya.');
      return;
    }

    setSaving(true);
    try {
      await uploadPortfolioVideo(file, {
        title,
        client,
        category,
        description,
        role,
        published,
        aspectRatio,
      }, previewFile, thumbnailFile);

      setTitle('');
      setClient('');
      setCategory(categories[0]);
      setDescription('');
      setRole('');
      setAspectRatio('9:16');
      setFile(null);
      setPreviewFile(null);
      setThumbnailFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      setPreviewUrl('');
      setThumbnailUrl('');
      setProcessingProgress(0);
      setPublished(true);

      for (const id of [
        'portfolio-video-file',
      ]) {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input) input.value = '';
      }

      await refresh();
      setNotice(published ? 'Video berhasil diunggah dan dipublikasikan.' : 'Video berhasil diunggah sebagai draft.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload video gagal.');
    } finally {
      setSaving(false);
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
      await refresh();
      setNotice('Video berhasil dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus video.');
    }
  }

  if (!sessionReady) {
    return <main className="admin-page"><div className="admin-content">Memeriksa sesi admin...</div></main>;
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a className="admin-brand" href="/">
          <span className="admin-brand-mark">V.</span>
          <span>CREATOR PORTFOLIO<small>CONTENT MANAGEMENT</small></span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {isAdmin && (
            <button type="button" className="admin-back" onClick={() => void logout()}>
              <LogOut size={16} /> LOGOUT
            </button>
          )}
          <a className="admin-back" href="/"><ArrowLeft size={16} /> LIHAT PORTOFOLIO</a>
        </div>
      </header>

      <div className="admin-content">
        {!isAdmin ? (
          <section className="admin-form" style={{ maxWidth: 520, margin: '50px auto' }}>
            <div className="admin-heading">
              <div>
                <span className="admin-eyebrow"><span /> ADMIN LOGIN</span>
                <h1>YOUR WORK.<br /><span>YOUR CONTROL.</span></h1>
                <p>Login menggunakan akun admin Supabase yang sudah dibuat.</p>
              </div>
            </div>

            {error && <div className="admin-alert error" role="alert">{error}</div>}
            {notice && <div className="admin-alert success" role="status"><CheckCircle2 size={17} />{notice}</div>}

            <form onSubmit={login}>
              <label className="admin-label">
                EMAIL ADMIN
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
              </label>
              <label className="admin-label">
                PASSWORD
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
              <button className="admin-submit" type="submit" disabled={loading}>
                {loading ? <><LoaderCircle className="spin" size={17} /> MEMERIKSA...</> : <><LogIn size={17} /> LOGIN ADMIN</>}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="admin-heading">
              <div>
                <span className="admin-eyebrow"><span /> ADMIN WORKSPACE</span>
                <h1>UPLOAD YOUR<br /><span>VIDEO WORK.</span></h1>
                <p>Unggah MP4 ke penyimpanan online dan kelola galeri portofoliomu.</p>
              </div>
              <div className="admin-count">
                <Film size={20} /><strong>{records.length.toString().padStart(2, '0')}</strong><span>VIDEO TERSIMPAN</span>
              </div>
            </div>

            {error && <div className="admin-alert error" role="alert">{error}</div>}
            {notice && <div className="admin-alert success" role="status"><CheckCircle2 size={17} />{notice}</div>}

            <div className="admin-layout">
              <form className="admin-form" onSubmit={submit}>
                <div className="admin-form-title">
                  <span className="admin-step">01</span>
                  <div><h2>DETAIL KARYA</h2><p>Informasi yang tampil di galeri.</p></div>
                </div>

                <label className="admin-label">JUDUL VIDEO
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Menu Andalan Bakmi Jowo" maxLength={90} required />
                </label>

                <div className="admin-two-col">
                  <label className="admin-label">BRAND / KLIEN
                    <input value={client} onChange={e => setClient(e.target.value)} placeholder="Nama brand (opsional)" maxLength={80} />
                  </label>
                  <label className="admin-label">KATEGORI
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                </div>

                <label className="admin-label">DESKRIPSI
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ceritakan konsep video..." rows={3} maxLength={400} />
                </label>

                <label className="admin-label">KONTRIBUSI KAMU
                  <input value={role} onChange={e => setRole(e.target.value)} placeholder="Contoh: Ide, shooting, editing" maxLength={150} />
                </label>

                <label className="admin-label">RASIO VIDEO
                  <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value as '9:16' | '16:9' | '1:1')}>
                    <option value="9:16">Vertikal — 9:16</option>
                    <option value="16:9">Horizontal — 16:9</option>
                    <option value="1:1">Kotak — 1:1</option>
                  </select>
                </label>

                <div className="admin-form-title upload-title">
                  <span className="admin-step">02</span>
                  <div><h2>FILE VIDEO</h2><p>Format MP4, maksimal 50 MB.</p></div>
                </div>

                <label className="admin-label">PILIH FILE MP4
                  <input
                    id="portfolio-video-file"
                    type="file"
                    accept="video/mp4,.mp4"
                    required
                    onChange={e => void handleOriginalSelected(e.target.files?.[0] ?? null)}
                  />
                  <small className="admin-help">{file ? `${file.name} — ${(file.size / (1024 * 1024)).toFixed(1)} MB` : 'Pilih video MP4 dari komputer.'}</small>
                </label>

                <div className="admin-label">
                  <strong>PEMROSESAN OTOMATIS</strong>
                  <small className="admin-help">
                    Preview MP4 dan thumbnail JPG dibuat otomatis di browser. Biarkan tab ini terbuka selama proses berlangsung.
                  </small>
                  {processingVideo && (
                    <div role="status" aria-live="polite">
                      <LoaderCircle className="spin" size={17} />
                      {' '}MEMPROSES VIDEO... {processingProgress}%
                      <progress value={processingProgress} max={100} style={{ width: '100%' }} />
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
                        style={{ width: '100%', maxHeight: 360, background: '#000', borderRadius: 8 }}
                      />
                      <small className="admin-help">
                        Ukuran preview: {(previewFile!.size / (1024 * 1024)).toFixed(2)} MB
                      </small>
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
                      <small className="admin-help">
                        Ukuran gambar: {(thumbnailFile!.size / (1024 * 1024)).toFixed(2)} MB
                      </small>
                    </div>
                  )}
                </div>

                <label className="admin-publish">
                  <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
                  <span className="admin-checkmark" />
                  <span><strong>Publikasikan di galeri</strong><small>Matikan untuk menyimpan sebagai draft.</small></span>
                </label>

                <button className="admin-submit" type="submit" disabled={saving || processingVideo || !file || !previewFile || !thumbnailFile}>
                  {processingVideo ? <><LoaderCircle className="spin" size={17} /> MEMPROSES VIDEO...</> : saving ? <><LoaderCircle className="spin" size={17} /> MENGUNGGAH...</> : <><Plus size={18} /> UPLOAD VIDEO</>}
                </button>
              </form>

              <aside className="admin-library">
                <div className="admin-library-heading">
                  <div><span className="admin-step">03</span><h2>DAFTAR VIDEO</h2></div>
                  <span>{records.length} ITEM</span>
                </div>

                {records.length === 0 ? (
                  <div className="admin-empty"><Video size={25} /><strong>Belum ada video</strong><p>Video yang diunggah akan muncul di sini.</p></div>
                ) : (
                  <div className="admin-records">
                    {records.map(record => (
                      <article className="admin-record" key={record.id}>
                        <div className="admin-record-thumb"><Video size={21} /><span>{record.published ? 'PUBLISHED' : 'DRAFT'}</span></div>
                        <div className="admin-record-info">
                          <strong>{record.title}</strong>
                          <small>{record.client || record.category}</small>
                          <small>{new Date(record.created_at).toLocaleDateString('id-ID')}</small>
                        </div>
                        <button type="button" className="admin-delete" onClick={() => void remove(record)} aria-label={`Hapus ${record.title}`}><Trash2 size={16} /></button>
                      </article>
                    ))}
                  </div>
                )}

                <a className="admin-preview-link" href="/">BUKA HALAMAN PORTOFOLIO <ArrowLeft size={14} /></a>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

