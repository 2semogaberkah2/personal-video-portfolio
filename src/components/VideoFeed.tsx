import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { projects as bundledProjects, type VideoProject } from '../data/projects';
import { getLocalProjects } from '../storage/localProjects';
import VideoItem from './VideoItem';
import VideoModal from './VideoModal';
export default function VideoFeed() {
 const [selected, setSelected] = useState<VideoProject | null>(null);
 const [activePreview, setActivePreview] = useState<string | null>(null);
 const [localProjects, setLocalProjects] = useState<VideoProject[]>([]);
 const closeModal = useCallback(() => setSelected(null), []);
 useEffect(() => { let alive = true; getLocalProjects().then(items => { if (alive) setLocalProjects(items); }).catch(() => { /* IndexedDB may be unavailable; bundled projects still work. */ }); return () => { alive = false; }; }, []);
 const visibleProjects = [...localProjects.filter(p => p.published), ...bundledProjects.filter(p => p.published && p.thumbnail && p.title && p.title !== 'Project title')];
 return <section className="work section-wrap" id="work"><div className="section-heading"><div><span className="section-kicker">THE WORK</span><h2>MADE TO BE <span>WATCHED.</span></h2></div><span className="section-count">{String(visibleProjects.length).padStart(2,'0')} PROJECTS</span></div>
 {visibleProjects.length ? <div className="video-grid">{visibleProjects.map(project => <VideoItem key={project.id} project={project} onOpen={setSelected} onPreview={setActivePreview} activePreview={activePreview}/>)}</div> : <div className="empty-work"><div className="empty-icon"><Play size={19}/></div><div><h3>YOUR WORK GOES HERE.</h3><p>Galeri akan menampilkan karya setelah kamu menambahkan link video TikTok. Proyek contoh belum dipublikasikan agar tidak terlihat seperti karya asli.</p><a className="empty-admin-link" href="/admin">BUKA ADMIN & UPLOAD VIDEO ↗</a></div></div>}
 <VideoModal project={selected} onClose={closeModal}/></section>;
}
