import { useEffect, useRef } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { VideoProject } from '../data/projects';
type Props = { project: VideoProject | null; onClose: () => void };
export default function VideoModal({ project, onClose }: Props) {
 const closeRef = useRef<HTMLButtonElement>(null); const previousFocus = useRef<HTMLElement | null>(null);
 useEffect(() => {
  if (!project) return;
  previousFocus.current = document.activeElement as HTMLElement;
  const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeRef.current?.focus();
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  document.addEventListener('keydown', onKey);
  return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previousFocus.current?.focus(); };
 }, [project, onClose]);
 if (!project) return null;
 return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="video-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Tutup video"><X size={21}/></button><div className="modal-player">{project.tiktokVideoId ? <iframe title={`Video TikTok: ${project.title}`} src={`https://www.tiktok.com/player/v1/${project.tiktokVideoId}?music_info=1&description=1`} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" /> : project.fullVideo ? <video src={project.fullVideo} poster={project.thumbnail} controls autoPlay playsInline preload="metadata">Browser Anda tidak mendukung video.</video> : <div className="modal-no-video"><span>VIDEO BELUM TERSEDIA</span><p>Tambahkan link video TikTok yang valid melalui halaman admin.</p></div>}</div><div className="modal-info"><div><span className="modal-kicker">{project.category ?? 'PROJECT'}</span><h2 id="modal-title">{project.title}</h2><p className="modal-client">{project.client ?? 'Independent project'}</p>{project.description && <p className="modal-description">{project.description}</p>}{project.role && <p className="modal-role"><b>CONTRIBUTION</b><br/>{project.role}</p>}</div>{project.externalUrl && <a className="original-link" href={project.externalUrl} target="_blank" rel="noreferrer">VIEW ORIGINAL <ArrowUpRight size={15}/></a>}</div></section></div>;
}
