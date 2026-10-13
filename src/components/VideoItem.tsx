import { useState } from 'react';
import { ArrowUpRight, Play } from 'lucide-react';
import type { VideoProject } from '../data/projects';

type Props = { project: VideoProject; onOpen: (project: VideoProject) => void; onPreview: (id: string | null) => void; activePreview: string | null };

export default function VideoItem({ project, onOpen }: Props) {
 const [imageFailed, setImageFailed] = useState(false);
 const ratio = project.aspectRatio === '16:9' ? '16 / 9' : project.aspectRatio === '1:1' ? '1 / 1' : '9 / 16';
 const tiktokEmbed = project.tiktokVideoId
   ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?music_info=1&description=1`
   : null;

 return <article className="video-item-card">
   <div className="video-frame" style={{ aspectRatio: ratio }}>
    {tiktokEmbed ? <iframe
      className="video-tiktok-embed"
      title={`Video TikTok: ${project.title}`}
      src={tiktokEmbed}
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    /> : <button type="button" className="video-card-fallback" onClick={() => onOpen(project)} aria-label={`Buka video ${project.title}`}>
      {!imageFailed && project.thumbnail && <img className="video-poster" src={project.thumbnail} alt={`Thumbnail ${project.title}`} loading="lazy" onError={() => setImageFailed(true)} style={{ objectPosition: project.posterPosition ?? 'center' }} />}
      {(imageFailed || !project.thumbnail) && <div className="asset-placeholder"><span className="placeholder-icon"><Play size={18}/></span><span>VIDEO PROJECT</span><small>{project.client ?? project.id}</small></div>}
      <span className="video-open"><ArrowUpRight size={18}/></span>
      <span className="video-index">OPEN VIDEO</span>
    </button>}
   </div>
   <div className="video-meta"><div><h3>{project.title}</h3><p>{project.client ?? 'Independent project'}</p></div><span className="project-category">{project.category ?? 'VIDEO'}</span></div>
 </article>;
}
