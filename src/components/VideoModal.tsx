import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { VideoProject } from '../data/projects';

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
  const [thumbIndices, setThumbIndices] = useState<Record<string, number>>({});

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
    const feed = feedRef.current;
    if (!feed || !project) return;

    let debounceTimer: number | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (Number.isFinite(index)) {
              if (debounceTimer) window.clearTimeout(debounceTimer);
              debounceTimer = window.setTimeout(() => {
                setSettledIndex((current) => {
                  if (current !== index) {
                    setPlayerReady(false);
                    return index;
                  }
                  return current;
                });
              }, 160);
            }
          }
        });
      },
      { root: feed, threshold: [0.35, 0.55, 0.8] }
    );

    slideRefs.current.forEach((slide) => slide && observer.observe(slide));
    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      observer.disconnect();
    };
  }, [project, feedProjects.length]);

  // Handler player pada slide aktif setelah settledIndex berhenti
  useEffect(() => {
    if (!project || !activeProject) return;
    setPlayerReady(false);

    let forceTimer: number | null = null;

    // Safety timeout 1500ms agar tombol play native tetap bisa disentuh bila autoplay diblokir
    forceTimer = window.setTimeout(() => {
      setPlayerReady(true);
    }, 1500);

    const handleMessage = (event: MessageEvent) => {
      if (!activeIframeRef.current || event.source !== activeIframeRef.current.contentWindow) {
        return;
      }
      const data = event.data as { 'x-tiktok-player'?: boolean; type?: string } | null;
      if (data && data['x-tiktok-player'] && data.type === 'onPlayerReady') {
        sendTikTokMessage(activeIframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokMessage(activeIframeRef.current, 'play');
        setPlayerReady(true);
        if (forceTimer) window.clearTimeout(forceTimer);
      }
    };

    window.addEventListener('message', handleMessage);

    if (activeVideoRef.current) {
      activeVideoRef.current.muted = isMutedRef.current;
      activeVideoRef.current.play().catch(() => {});
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      if (forceTimer) window.clearTimeout(forceTimer);
    };
  }, [project, settledIndex, activeProject]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (activeVideoRef.current) {
      activeVideoRef.current.muted = nextMuted;
      if (!nextMuted && activeVideoRef.current.paused) {
        activeVideoRef.current.play().catch(() => {});
      }
    }

    if (playerReadyRef.current) {
      if (activeProject?.tiktokVideoId) {
        sendTikTokMessage(activeIframeRef.current, nextMuted ? 'mute' : 'unMute');
      } else if (activeProject?.youtubeVideoId) {
        sendYouTubeMessage(activeIframeRef.current, nextMuted ? 'mute' : 'unMute');
      }
    }
  };

  if (!project) return null;

  return (
    <div
      className="scroll-preview-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Preview karya video"
    >
      {/* Topbar Navigasi & Kontrol */}
      <header className="scroll-preview-topbar">
        <div className="scroll-preview-topbar-left">
          <button
            ref={closeRef}
            type="button"
            className="scroll-preview-close"
            onClick={onClose}
            aria-label="Tutup preview"
          >
            <X size={20} />
            <span>TUTUP</span>
          </button>

          <button
            type="button"
            className={
              isMuted
                ? 'scroll-preview-mute is-muted'
                : 'scroll-preview-mute is-unmuted'
            }
            onClick={toggleMute}
            aria-label={isMuted ? 'Aktifkan suara video' : 'Matikan suara video'}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            <span>{isMuted ? 'UNMUTE SUARA' : 'SUARA AKTIF'}</span>
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

          const candidates = [item.thumbnail, ...(item.thumbnailFallbacks ?? [])].filter(
            (c): c is string => Boolean(c && c.trim())
          );
          const currentThumbIdx = thumbIndices[item.id] ?? 0;
          const currentCoverUrl = candidates[currentThumbIdx] || '';

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
                  {/* Layer Dasar: <img> Cover selalu ada di bawah */}
                  {currentCoverUrl ? (
                    <img
                      className="viewer-inactive-poster"
                      src={currentCoverUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      decoding="async"
                      onError={() =>
                        setThumbIndices((prev) => ({
                          ...prev,
                          [item.id]: (prev[item.id] ?? 0) + 1,
                        }))
                      }
                    />
                  ) : mp4Source ? (
                    <video
                      className="viewer-inactive-poster"
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
                          poster={item.thumbnail || undefined}
                          controls
                          autoPlay
                          loop
                          muted={isMuted}
                          playsInline
                          preload="auto"
                          onPlaying={() => setPlayerReady(true)}
                        >
                          Browser Anda tidak mendukung video.
                        </video>
                      ) : (
                        <div className="modal-no-video">
                          <span>VIDEO BELUM TERSEDIA</span>
                          <p>Tambahkan sumber video yang valid melalui halaman admin.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 2. Area Informasi Teks di Luar Video */}
                <div className="viewer-info-box">
                  <div className="viewer-info-main">
                    <div className="viewer-info-meta-top">
                      <span className="viewer-kicker">{item.category || 'VIDEO PROJECT'}</span>
                      <span className="viewer-order-badge">
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                    </div>

                    <h2 className="viewer-title">{item.title}</h2>
                    <p className="viewer-client">{item.client || 'Independent project'}</p>

                    {item.description && (
                      <p className="viewer-description">{item.description}</p>
                    )}

                    {item.role && (
                      <div className="viewer-role">
                        <strong>KONTRIBUSI</strong>
                        <p>{item.role}</p>
                      </div>
                    )}
                  </div>

                  <div className="viewer-info-actions">
                    <button
                      type="button"
                      className="viewer-contact-cta"
                      onClick={handleGoToContact}
                    >
                      TERTARIK? HUBUNGI HAFID <ArrowDown size={15} />
                    </button>

                    <div className="viewer-secondary-actions">
                      <button type="button" className="viewer-mute-btn" onClick={toggleMute}>
                        {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        <span>{isMuted ? 'UNMUTE VIDEO' : 'MUTE VIDEO'}</span>
                      </button>

                      {item.externalUrl && (
                        <a
                          className="viewer-original-link"
                          href={item.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          LIHAT VIDEO ASLI <ArrowUpRight size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="scroll-preview-hint">
        SCROLL / GESER ATAS & BAWAH UNTUK KARYA LAINNYA
      </div>
    </div>
  );
}
