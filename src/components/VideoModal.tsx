import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, Play, X } from 'lucide-react';
import type { VideoProject } from '../data/projects';

type Props = {
  project: VideoProject | null;
  projects?: VideoProject[];
  onClose: () => void;
};

function getProjectPlayer(project: VideoProject, mobile = false) {
  if (project.youtubeVideoId) {
    return (
      <iframe
        title={`Video YouTube: ${project.title}`}
        src={`https://www.youtube-nocookie.com/embed/${project.youtubeVideoId}?autoplay=1&playsinline=1&rel=0`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        loading="eager"
      />
    );
  }

  if (project.tiktokVideoId) {
    return (
      <iframe
        title={`Video TikTok: ${project.title}`}
        src={`https://www.tiktok.com/player/v1/${project.tiktokVideoId}?autoplay=1&music_info=1&description=1`}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        loading="eager"
      />
    );
  }

  if (project.fullVideo || project.previewVideo) {
    return (
      <video
        src={project.fullVideo || project.previewVideo}
        poster={project.thumbnail || undefined}
        controls
        autoPlay
        muted={false}
        playsInline
        preload={mobile ? 'auto' : 'metadata'}
      >
        Browser Anda tidak mendukung video.
      </video>
    );
  }

  return (
    <div className="modal-no-video">
      <span>VIDEO BELUM TERSEDIA</span>
      <p>Tambahkan sumber video yang valid melalui halaman admin.</p>
    </div>
  );
}

export default function VideoModal({ project, projects = [], onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const feedProjects = projects.length ? projects : project ? [project] : [];
  const initialIndex = Math.max(0, feedProjects.findIndex((item) => item.id === project?.id));

  const goTo = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(index, feedProjects.length - 1));
      slideRefs.current[safeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveIndex(safeIndex);
    },
    [feedProjects.length]
  );

  useEffect(() => {
    const query = window.matchMedia('(max-width: 600px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!project) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (isMobile && event.key === 'ArrowDown') {
        event.preventDefault();
        goTo(activeIndexRef.current + 1);
      }
      if (isMobile && event.key === 'ArrowUp') {
        event.preventDefault();
        goTo(activeIndexRef.current - 1);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus();
    };
  }, [project, onClose, isMobile, goTo]);

  useEffect(() => {
    if (!project || !isMobile) return;
    setActiveIndex(initialIndex);
    requestAnimationFrame(() => {
      slideRefs.current[initialIndex]?.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
  }, [project?.id, isMobile, initialIndex]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !isMobile || !project) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isFinite(index)) setActiveIndex(index);
          }
        });
      },
      { root: feed, threshold: [0.35, 0.6, 0.85] }
    );

    slideRefs.current.forEach((slide) => slide && observer.observe(slide));
    return () => observer.disconnect();
  }, [isMobile, project, feedProjects.length]);

  if (!project) return null;

  if (isMobile) {
    return (
      <div className="mobile-video-viewer" role="dialog" aria-modal="true" aria-label="Video portfolio">
        <div className="mobile-video-topbar">
          <button
            ref={closeRef}
            type="button"
            className="mobile-video-close"
            onClick={onClose}
            aria-label="Kembali ke daftar video"
          >
            <X size={22} />
          </button>
          <span>
            {activeIndex + 1} <i>/</i> {feedProjects.length}
          </span>
          <div className="mobile-video-arrows">
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Video sebelumnya"
            >
              <ChevronUp size={19} />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === feedProjects.length - 1}
              aria-label="Video berikutnya"
            >
              <ChevronDown size={19} />
            </button>
          </div>
        </div>

        <div className="mobile-video-feed" ref={feedRef}>
          {feedProjects.map((item, index) => {
            const mp4Source = item.previewVideo || item.fullVideo;
            return (
              <section
                className="mobile-video-slide"
                key={item.id}
                data-index={index}
                ref={(element) => {
                  slideRefs.current[index] = element;
                }}
              >
                {index === activeIndex ? (
                  <div className="mobile-video-player">{getProjectPlayer(item, true)}</div>
                ) : item.thumbnail ? (
                  <img className="mobile-video-poster" src={item.thumbnail} alt="" loading="lazy" />
                ) : mp4Source ? (
                  <video
                    className="mobile-video-poster"
                    src={`${mp4Source}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="asset-placeholder">
                    <span className="placeholder-icon">
                      <Play size={22} />
                    </span>
                    <span>{item.title}</span>
                  </div>
                )}
                <div className="mobile-video-gradient" />
                <div className="mobile-video-caption">
                  <span>{item.category || 'VIDEO PROJECT'}</span>
                  <h2>{item.title}</h2>
                  <p>{item.client || 'Independent project'}</p>
                  {item.description && (
                    <p className="mobile-video-description">{item.description}</p>
                  )}
                  {item.externalUrl && (
                    <a href={item.externalUrl} target="_blank" rel="noreferrer">
                      LIHAT VIDEO ASLI <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
                <div className="mobile-video-side-count">
                  {String(index + 1).padStart(2, '0')}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mobile-video-swipe-hint">GESER KE ATAS / BAWAH UNTUK VIDEO LAIN</div>
      </div>
    );
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="video-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <button ref={closeRef} className="modal-close" onClick={onClose} aria-label="Tutup video">
          <X size={21} />
        </button>
        <div className="modal-player">{getProjectPlayer(project, false)}</div>
        <div className="modal-info">
          <div>
            <span className="modal-kicker">{project.category ?? 'PROJECT'}</span>
            <h2 id="modal-title">{project.title}</h2>
            <p className="modal-client">{project.client ?? 'Independent project'}</p>
            {project.description && <p className="modal-description">{project.description}</p>}
            {project.role && (
              <p className="modal-role">
                <b>CONTRIBUTION</b>
                <br />
                {project.role}
              </p>
            )}
          </div>
          {project.externalUrl && (
            <a className="original-link" href={project.externalUrl} target="_blank" rel="noreferrer">
              VIEW ORIGINAL <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
