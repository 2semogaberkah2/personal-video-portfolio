import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { VideoProject } from '../data/projects';
import { CoverImage } from './CoverImage';
import { buildCoverCandidates } from '../lib/cover';

type Props = {
  project: VideoProject | null;
  projects?: VideoProject[];
  onClose: () => void;
};

function sendTikTokMessage(iframe: HTMLIFrameElement | null, type: string, value?: unknown) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ 'x-tiktok-player': true, type, value }, '*');
}

function sendYouTubeMessage(iframe: HTMLIFrameElement | null, func: string) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

export default function VideoModal({ project, projects = [], onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [settledIndex, setSettledIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [playerReady, setPlayerReady] = useState(false);

  const settledIndexRef = useRef(0);
  settledIndexRef.current = settledIndex;

  const isMutedRef = useRef(true);
  isMutedRef.current = isMuted;

  const playerReadyRef = useRef(false);
  playerReadyRef.current = playerReady;

  const feedProjects = projects.length ? projects : project ? [project] : [];
  const initialIndex = Math.max(
    0,
    feedProjects.findIndex((item) => item.id === project?.id)
  );
  const activeProject = feedProjects[settledIndex] ?? project;

  // goTo hanya memanggil scrollIntoView tanpa mengubah state langsung
  const goTo = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(index, feedProjects.length - 1));
      slideRefs.current[safeIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    },
    [feedProjects.length]
  );

  const handleGoToContact = useCallback(() => {
    onClose();
    window.setTimeout(() => {
      const contactSection = document.getElementById('contact');
      contactSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [onClose]);

  useEffect(() => {
    if (!project) return;
    setIsMuted(true);
    setPlayerReady(false);
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        goTo(settledIndexRef.current + 1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        goTo(settledIndexRef.current - 1);
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      previousFocus.current?.focus();
    };
  }, [project, onClose, goTo]);

  useEffect(() => {
    if (!project) return;
    setSettledIndex(initialIndex);
    requestAnimationFrame(() => {
      slideRefs.current[initialIndex]?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      });
    });
  }, [project?.id, initialIndex, project]);

  // Observer dengan debounce ~160ms sebagai satu-satunya sumber kebenaran settledIndex
  useEffect(() => {
    if (!project || !feedRef.current) return;

    let debounceTimer: number | null = null;
    let candidateIndex = settledIndexRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestVisible = candidateIndex;
        let bestRatio = 0;

        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            const targetIdx = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(targetIdx)) {
              bestVisible = targetIdx;
            }
          }
        }

        if (bestRatio > 0.55 && bestVisible !== candidateIndex) {
          candidateIndex = bestVisible;
          if (debounceTimer) window.clearTimeout(debounceTimer);

          debounceTimer = window.setTimeout(() => {
            setSettledIndex((current) => {
              if (current !== candidateIndex) {
                setPlayerReady(false);
                return candidateIndex;
              }
              return current;
            });
          }, 160);
        }
      },
      {
        root: feedRef.current,
        threshold: [0.3, 0.55, 0.8],
      }
    );

    const currentSlides = slideRefs.current;
    for (const slide of currentSlides) {
      if (slide) observer.observe(slide);
    }

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      for (const slide of currentSlides) {
        if (slide) observer.unobserve(slide);
      }
    };
  }, [project, feedProjects.length]);

  // Listener message TikTok player untuk auto-play & audio sync
  useEffect(() => {
    if (!project) return;

    const handleMessage = (event: MessageEvent) => {
      if (!activeIframeRef.current || event.source !== activeIframeRef.current.contentWindow) return;
      const data = event.data as { 'x-tiktok-player'?: boolean; type?: string } | null;
      if (data && data['x-tiktok-player'] && data.type === 'onPlayerReady') {
        sendTikTokMessage(activeIframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokMessage(activeIframeRef.current, 'play');
        setPlayerReady(true);
      }
    };

    window.addEventListener('message', handleMessage);

    const fallbackReadyTimer = window.setTimeout(() => {
      if (activeIframeRef.current) {
        sendTikTokMessage(activeIframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokMessage(activeIframeRef.current, 'play');
        setPlayerReady(true);
      }
    }, 1300);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackReadyTimer);
    };
  }, [settledIndex, project]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (activeVideoRef.current) {
      activeVideoRef.current.muted = nextMuted;
    }

    if (activeIframeRef.current) {
      const isYouTube = Boolean(activeProject?.youtubeVideoId);
      const isTikTok = Boolean(activeProject?.tiktokVideoId);

      if (isYouTube) {
        sendYouTubeMessage(activeIframeRef.current, nextMuted ? 'mute' : 'unMute');
      } else if (isTikTok) {
        sendTikTokMessage(activeIframeRef.current, nextMuted ? 'mute' : 'unMute');
      }
    }
  };

  if (!project) return null;

  return (
    <div
      className="scroll-preview-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Mode Nonton Portofolio"
    >
      {/* Top Bar Kontrol */}
      <header className="scroll-preview-topbar">
        <div className="scroll-preview-topbar-left">
          <button
            ref={closeRef}
            type="button"
            className="scroll-preview-close"
            onClick={onClose}
            aria-label="Tutup preview"
          >
            <X size={17} />
            <span>TUTUP</span>
          </button>

          <button
            type="button"
            className={isMuted ? 'scroll-preview-mute is-muted' : 'scroll-preview-mute is-unmuted'}
            onClick={toggleMute}
            aria-label={isMuted ? 'Nyalakan audio' : 'Bisukan audio'}
            title={isMuted ? 'Klik untuk mendengarkan audio' : 'Matikan audio'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            <span>{isMuted ? 'MUTED' : 'AUDIO ON'}</span>
          </button>
        </div>

        <div className="scroll-preview-counter">
          {String(settledIndex + 1).padStart(2, '0')} <i>/</i>{' '}
          {String(feedProjects.length).padStart(2, '0')}
        </div>

        <div className="scroll-preview-topbar-right">
          <button
            type="button"
            className="scroll-preview-cta-top"
            onClick={handleGoToContact}
          >
            KONTAK SAYA <ArrowDown size={14} />
          </button>

          <div className="scroll-preview-arrows">
            <button
              type="button"
              onClick={() => goTo(settledIndex - 1)}
              disabled={settledIndex === 0}
              aria-label="Video sebelumnya"
              title="Video sebelumnya"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              onClick={() => goTo(settledIndex + 1)}
              disabled={settledIndex === feedProjects.length - 1}
              aria-label="Video berikutnya"
              title="Video berikutnya"
            >
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Area Feed Scroll Atas-Bawah */}
      <div className="scroll-preview-feed" ref={feedRef}>
        {feedProjects.map((item, index) => {
          const isCurrent = index === settledIndex;
          const mp4Source = item.fullVideo || item.previewVideo;

          const candidates = buildCoverCandidates({
            thumbnailPath: item.thumbnail,
            tiktokId: item.tiktokVideoId,
            tiktokUrl: item.fullVideo,
            youtubeId: item.youtubeVideoId,
            customThumbnails: item.thumbnailFallbacks,
          });

          return (
            <section
              className="scroll-preview-slide"
              key={item.id}
              data-index={index}
              ref={(element) => {
                slideRefs.current[index] = element;
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
              }}
            >
              <div className="viewer-slide-card">
                {/* 1. Area Video */}
                <div className="viewer-video-box">
                  {/* Layer Dasar: <CoverImage> selalu ada di bawah */}
                  <CoverImage
                    candidates={candidates}
                    id={item.id}
                    title={item.title}
                    subtitle={item.client}
                    category={item.category}
                    priority={isCurrent}
                  />

                  {/* Layer Atas: Player aktif HANYA di-mount untuk index === settledIndex */}
                  {isCurrent && (
                    <>
                      {item.youtubeVideoId ? (
                        <iframe
                          ref={activeIframeRef}
                          className={playerReady ? 'modal-player-frame is-ready' : 'modal-player-frame'}
                          title={`Video YouTube: ${item.title}`}
                          src={`https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1&loop=1&playlist=${item.youtubeVideoId}`}
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          loading="eager"
                          onLoad={() => {
                            sendYouTubeMessage(activeIframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
                            sendYouTubeMessage(activeIframeRef.current, 'playVideo');
                            setPlayerReady(true);
                          }}
                        />
                      ) : item.tiktokVideoId ? (
                        <iframe
                          ref={activeIframeRef}
                          className={playerReady ? 'modal-player-frame is-ready' : 'modal-player-frame'}
                          title={`Video TikTok: ${item.title}`}
                          src={`https://www.tiktok.com/player/v1/${item.tiktokVideoId}?autoplay=1&loop=1&music_info=0&description=0&rel=0&native_context_menu=0&closed_caption=0`}
                          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                          allowFullScreen
                          loading="eager"
                        />
                      ) : mp4Source ? (
                        <video
                          ref={activeVideoRef}
                          className="modal-player-frame is-ready"
                          src={mp4Source}
                          muted={isMuted}
                          playsInline
                          autoPlay
                          loop
                          controls
                          onPlaying={() => setPlayerReady(true)}
                        />
                      ) : null}
                    </>
                  )}
                </div>

                {/* 2. Area Teks & Keterangan Rapi di Samping */}
                <div className="viewer-info-panel">
                  <div className="viewer-info-meta-top">
                    <span className="viewer-kicker">
                      {item.category} · {item.aspectRatio}
                    </span>
                    <span className="viewer-order-badge">#{String(index + 1).padStart(2, '0')}</span>
                  </div>

                  <h2 className="viewer-title">{item.title}</h2>
                  {item.client && <p className="viewer-client">Klien: {item.client}</p>}

                  {item.description && <p className="viewer-description">{item.description}</p>}

                  {item.role && (
                    <div className="viewer-role">
                      <strong>PERAN / SOFTWARE</strong>
                      <p>{item.role}</p>
                    </div>
                  )}

                  <div className="viewer-info-actions">
                    <button
                      type="button"
                      className="viewer-contact-btn"
                      onClick={handleGoToContact}
                    >
                      KONSULTASI PROJECT INI <ArrowDown size={15} />
                    </button>

                    {item.fullVideo && (
                      <a
                        href={item.fullVideo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="viewer-original-link"
                      >
                        LIHAT VIDEO ASLI <ArrowUpRight size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
