import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Film, LoaderCircle, Plus, Trash2, Video, ExternalLink } from 'lucide-react';
import { deleteLocalProject, getStoredProjects, saveLocalProject, type StoredProject } from '../storage/localProjects';

const categories = ['TikTok Content', 'Product Video', 'Food & Beverage', 'Brand Content', 'Lifestyle', 'Affiliate Content', 'Promotional Video'];

function parseTikTokUrl(value: string): { url: string; videoId: string } | null {
  try {
    const url = new URL(value.trim());
    if (!['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (match) return { url: url.toString(), videoId: match[1] };
    // Short links do not expose the video ID until redirected, so ask for the full TikTok video URL.
    return null;
  } catch { return null; }
}

export default function AdminPanel() {
  const [records, setRecords] = useState<StoredProject[]>([]);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [published, setPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    try { setRecords(await getStoredProjects()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Tidak dapat membaca data browser.'); }
  }
  useEffect(() => { void refresh(); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setNotice('');
    const parsed = parseTikTokUrl(tiktokUrl);
    if (!parsed) { setError('Masukkan link video TikTok lengkap, contohnya https://www.tiktok.com/@username/video/123456789. Link pendek vm.tiktok.com belum didukung.'); return; }
    setSaving(true);
    try {
      const id = `tiktok-${parsed.videoId}`;
      const project = {
        id, title: title.trim(), client: client.trim() || undefined, category,
        thumbnail: '', previewVideo: '', fullVideo: '', tiktokUrl: parsed.url,
        tiktokVideoId: parsed.videoId, externalUrl: parsed.url,
        description: description.trim() || undefined, role: role.trim() || undefined,
        featured: false, published, aspectRatio: '9:16' as const,
      };
      await saveLocalProject({ project, createdAt: Date.now() });
      setTitle(''); setClient(''); setCategory(categories[0]); setDescription(''); setRole(''); setTiktokUrl(''); setPublished(true);
      await refresh();
      setNotice('Link TikTok tersimpan di browser ini. Untuk menampilkannya kepada semua pengunjung website statis, tambahkan data ke src/data/projects.ts lalu deploy ulang, atau hubungkan database online.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan link TikTok.'); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm('Hapus proyek ini dari daftar yang tersimpan di browser?')) return;
    try { await deleteLocalProject(id); await refresh(); setNotice('Proyek dihapus dari browser ini.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal menghapus proyek.'); }
  }

  return <main className="admin-page">
    <header className="admin-topbar"><a className="admin-brand" href="/"><span className="admin-brand-mark">V.</span><span>CREATOR PORTFOLIO<small>CONTENT MANAGEMENT</small></span></a><a className="admin-back" href="/"><ArrowLeft size={16}/> LIHAT PORTOFOLIO</a></header>
    <div className="admin-content">
      <div className="admin-heading"><div><span className="admin-eyebrow"><span/> ADMIN WORKSPACE</span><h1>ADD YOUR<br/><span>TIKTOK WORK.</span></h1><p>Tambahkan karya dengan link TikTok tanpa mengunggah file video.</p></div><div className="admin-count"><Film size={20}/><strong>{records.length.toString().padStart(2, '0')}</strong><span>LINK TERSIMPAN</span></div></div>
      <div className="admin-notice"><strong>Mode gratis untuk website statis</strong><p>Website tidak menyimpan file video. Link TikTok disimpan di browser ini. Agar video baru otomatis muncul untuk semua pengunjung setelah di-hosting, dibutuhkan database online; alternatif tanpa database adalah memperbarui daftar proyek lalu deploy ulang.</p></div>
      {error && <div className="admin-alert error" role="alert">{error}</div>}{notice && <div className="admin-alert success" role="status"><CheckCircle2 size={17}/>{notice}</div>}
      <div className="admin-layout">
        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form-title"><span className="admin-step">01</span><div><h2>DETAIL KARYA</h2><p>Isi informasi yang ingin ditampilkan di galeri.</p></div></div>
          <label className="admin-label">JUDUL VIDEO <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: Menu Andalan Bakmi Jowo" required maxLength={90}/></label>
          <div className="admin-two-col"><label className="admin-label">BRAND / KLIEN <input value={client} onChange={e => setClient(e.target.value)} placeholder="Nama brand (opsional)" maxLength={80}/></label><label className="admin-label">KATEGORI <select value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label></div>
          <label className="admin-label">LINK VIDEO TIKTOK <input type="url" value={tiktokUrl} onChange={e => setTiktokUrl(e.target.value)} placeholder="https://www.tiktok.com/@akun/video/123..." required/><small className="admin-help">Gunakan link video lengkap, bukan link profil atau link pendek.</small></label>
          <label className="admin-label">DESKRIPSI <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ceritakan singkat konsep video..." rows={3} maxLength={400}/></label>
          <label className="admin-label">KONTRIBUSI KAMU <input value={role} onChange={e => setRole(e.target.value)} placeholder="Contoh: Editing, shooting, ide konten" maxLength={150}/></label>
          <div className="admin-form-title upload-title"><span className="admin-step">02</span><div><h2>TAUTAN VIDEO</h2><p>Video akan diputar melalui pemutar resmi TikTok.</p></div></div>
          <div className="admin-tiktok-hint"><ExternalLink size={20}/><div><strong>Tanpa upload file</strong><p>Pastikan video TikTok bersifat publik. TikTok dapat membatasi embed untuk video yang dihapus, privat, atau tidak tersedia.</p></div></div>
          <label className="admin-publish"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)}/><span className="admin-checkmark"/><span><strong>Publikasikan di galeri</strong><small>Menandai karya ini sebagai publik pada daftar proyek.</small></span></label>
          <button className="admin-submit" type="submit" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={17}/> MENYIMPAN...</> : <><Plus size={18}/> SIMPAN LINK TIKTOK</>}</button>
        </form>
        <aside className="admin-library"><div className="admin-library-heading"><div><span className="admin-step">03</span><h2>DAFTAR KARYA</h2></div><span>{records.length} ITEM</span></div>
          {records.length === 0 ? <div className="admin-empty"><Video size={25}/><strong>Belum ada link</strong><p>Link TikTok yang kamu simpan akan muncul di sini.</p></div> : <div className="admin-records">{records.map(record => <article className="admin-record" key={record.project.id}><div className="admin-record-thumb"><Video size={21}/><span>{record.project.published ? 'PUBLISHED' : 'DRAFT'}</span></div><div className="admin-record-info"><strong>{record.project.title}</strong><small>{record.project.client || record.project.category}</small><small>{record.project.tiktokVideoId}</small><a href={record.project.tiktokUrl} target="_blank" rel="noreferrer" className="admin-record-link">Buka di TikTok ↗</a></div><button type="button" className="admin-delete" onClick={() => void remove(record.project.id)} aria-label={`Hapus ${record.project.title}`}><Trash2 size={16}/></button></article>)}</div>}
          <a className="admin-preview-link" href="/">BUKA HALAMAN PORTOFOLIO <ArrowLeft size={14}/></a>
        </aside>
      </div>
      <p className="admin-footnote"><ExternalLink size={13}/> Ini mode lokal tanpa database dan tanpa login admin. Daftar yang disimpan dari browser ini tidak otomatis tersinkron dengan pengunjung lain.</p>
    </div>
  </main>;
}
