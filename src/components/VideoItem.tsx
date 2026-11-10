import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Play, Volume2, VolumeX } from 'lucide-react';
import type { VideoProject } from '../data/projects';

type Props = {
  project: VideoProject;
  index?: number;
  onOpen: (project: VideoProject) => void;
  onPreview: (id: string | null) => void;
  activePreview: string | null;
};

function sendTikTokCommand(iframe: HTMLIFrameElement | null, type: string, value?: unknown) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage({ 'x-tiktok-player': true, type, value }, '*');
}

function sendYouTubeCommand(iframe: HTMLIFrameElement | null, func: string) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

export default function VideoItem({
  project,
  index = 0,
  onOpen,
  onPreview,
  activePreview,
}: Props) {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [touchDevice, setTouchDevice] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [mountLive, setMountLive] = useState(false);
  const [liveReady, setLiveReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isMutedRef = useRef(isMuted);

  const ratio =
    project.aspectRatio === '16:9'
      ? '16 / 9'
      : project.aspectRatio === '1:1'
        ? '1 / 1'
        : '9 / 16';

  const isYouTube = Boolean(project.youtubeVideoId);
  const isTikTok = Boolean(project.tiktokVideoId);
  const previewUrl = project.previewVideo || project.fullVideo;
  const isMp4 = !isTikTok && !isYouTube && Boolean(previewUrl);

  const cleanTikTokParams =
    'controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&loop=1&rel=0&native_context_menu=0&closed_caption=0';

  const tiktokHoverEmbed = project.tiktokVideoId
    ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?autoplay=1&${cleanTikTokParams}`
    : null;

  const youtubeHoverEmbed = project.youtubeVideoId
    ? `https://www.youtube-nocookie.com/embed/${project.youtubeVideoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1&loop=1&playlist=${project.youtubeVideoId}`
    : null;

  const isActive = activePreview === project.id;
  const canLive = !touchDevice && !isMobileViewport && isActive && (isMp4 || isTikTok || isYouTube);

  const candidates = [project.thumbnail, ...(project.thumbnailFallbacks ?? [])].filter(
    (c): c is string => Boolean(c && c.trim())
  );
  const currentCover = candidates[candidateIndex] || '';

  // Reset indeks kandidat gambar bila id atau thumbnail berubah
  useEffect(() => {
    setCandidateIndex(0);
  }, [project.id, project.thumbnail]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const mobileQuery = window.matchMedia('(max-width: 600px)');

    const updateDevice = () => {
      setTouchDevice(!hoverQuery.matches);
      setIsMobileViewport(mobileQuery.matches);
    };
    updateDevice();

    hoverQuery.addEventListener('change', updateDevice);
    mobileQuery.addEventListener('change', updateDevice);

    return () => {
      hoverQuery.removeEventListener('change', updateDevice);
      mobileQuery.removeEventListener('change', updateDevice);
    };
  }, []);

  // Hover-intent delay 250ms sebelum me-mount layer live desktop
  useEffect(() => {
    if (!canLive) {
      setMountLive(false);
      setLiveReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setMountLive(true);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canLive]);

  // Handler TikTok message listener saat live layer desktop aktif
  useEffect(() => {
    if (!mountLive || !isTikTok) return;

    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as { 'x-tiktok-player'?: boolean; type?: string } | null;
      if (data && data['x-tiktok-player'] && data.type === 'onPlayerReady') {
        sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokCommand(iframeRef.current, 'play');
        setLiveReady(true);
      }
    };

    window.addEventListener('message', handleMessage);

    // Fallback timer bila onPlayerReady tidak diterima
    const fallbackTimer = window.setTimeout(() => {
      sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
      sendTikTokCommand(iframeRef.current, 'play');
      setLiveReady(true);
    }, 1200);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, [mountLive, isTikTok]);

  // Kontrol audio mute/unmute
  useEffect(() => {
    if (isMp4 && videoRef.current) {
      videoRef.current.muted = isMuted;
    } else if (isTikTok && iframeRef.current) {
      sendTikTokCommand(iframeRef.current, isMuted ? 'mute' : 'unMute');
    } else if (isYouTube && iframeRef.current) {
      sendYouTubeCommand(iframeRef.current, isMuted ? 'mute' : 'unMute');
    }
  }, [isMuted, isMp4, isTikTok, isYouTube]);

  // Reset mute ke default true saat kursor keluar
  useEffect(() => {
    if (!isActive) {
      setIsMuted(true);
    }
  }, [isActive]);

  const toggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (isMp4 && videoRef.current) {
      videoRef.current.muted = nextMuted;
      if (!nextMuted && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    } else if (isTikTok && iframeRef.current) {
      sendTikTokCommand(iframeRef.current, nextMuted ? 'mute' : 'unMute');
      sendTikTokCommand(iframeRef.current, 'play');
    } else if (isYouTube && iframeRef.current) {
      sendYouTubeCommand(iframeRef.current, nextMuted ? 'mute' : 'unMute');
      sendYouTubeCommand(iframeRef.current, 'playVideo');
    }
  };

  return (
    <article
      className="video-item-card"
      onMouseEnter={() => {
        if (!touchDevice && !isMobileViewport) {
          onPreview(project.id);
        }
      }}
      onMouseLeave={() => {
        if (!touchDevice && !isMobileViewport && isActive) {
          onPreview(null);
        }
      }}
      onFocus={() => {
        if (!touchDevice && !isMobileViewport) {
          onPreview(project.id);
        }
      }}
      onBlur={(event) => {
        if (
          !touchDevice &&
          !isMobileViewport &&
          isActive &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          onPreview(null);
        }
      }}
    >
      <div className="video-frame" style={{ aspectRatio: ratio }}>
        <div
          className="video-card-fallback"
          role="button"
          tabIndex={0}
          onClick={() => onOpen(project)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(project);
            }
          }}
          aria-label={`Buka video ${project.title}`}
        >
          {/* Layer 1 (Dasar): Cover Gambar Murni (Tidak pernah live iframe di touch/mobile) */}
          {currentCover ? (
            <img
              className="video-poster"
              src={currentCover}
              alt={`Thumbnail ${project.title}`}
              referrerPolicy="no-referrer"
              decoding="async"
              loading={index < 6 ? 'eager' : 'lazy'}
              onError={() => setCandidateIndex((prev) => prev + 1)}
              style={{ objectPosition: project.posterPosition ?? 'center' }}
            />
          ) : isMp4 && previewUrl ? (
            /* Last resort bila thumbnail MP4 kosong */
            <video
              className="video-poster"
              src={`${previewUrl}#t=0.1`}
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
            />
          ) : (
            <div className="asset-placeholder">
              <span className="placeholder-icon">
                <Play size={18} />
              </span>
              <span>{project.title}</span>
              <small>{project.client ?? project.category ?? 'VIDEO'}</small>
            </div>
          )}

          {/* Layer 2: Live Player Desktop (Mount hanya setelah hover-intent 250ms) */}
          {mountLive && (
            <>
              {isMp4 && previewUrl && (
                <video
                  ref={videoRef}
                  className={liveReady ? 'video-poster-live is-ready' : 'video-poster-live'}
                  src={previewUrl}
                  muted={isMuted}
                  loop
                  playsInline
                  autoPlay
                  preload="auto"
                  onPlaying={() => setLiveReady(true)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}

              {isTikTok && tiktokHoverEmbed && (
                <iframe
                  ref={iframeRef}
                  className={liveReady ? 'video-tiktok-embed is-ready' : 'video-tiktok-embed'}
                  title={`Preview TikTok: ${project.title}`}
                  src={tiktokHoverEmbed}
                  allow="autoplay; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}

              {isYouTube && youtubeHoverEmbed && (
                <iframe
                  ref={iframeRef}
                  className={liveReady ? 'video-tiktok-embed is-ready' : 'video-tiktok-embed'}
                  title={`Preview YouTube: ${project.title}`}
                  src={youtubeHoverEmbed}
                  allow="autoplay; encrypted-media"
                  referrerPolicy="strict-origin-when-cross-origin"
                  tabIndex={-1}
                  onLoad={() => {
                    sendYouTubeCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
                    sendYouTubeCommand(iframeRef.current, 'playVideo');
                    setLiveReady(true);
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                    pointerEvents: 'none',
                    zIndex: 2,
                  }}
                />
              )}
            </>
          )}

          {/* Tombol Mute/Unmute Desktop */}
          {!isMobileViewport && !touchDevice && isActive && (
            <button
              type="button"
              className="video-volume-toggle"
              onClick={toggleMute}
              aria-label={isMuted ? 'Aktifkan suara' : 'Matikan suara'}
              title={isMuted ? 'Aktifkan suara' : 'Matikan suara'}
            >
              {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
          )}

          {/* Overlay Play Icon tampil selama live layer belum aktif */}
          {!liveReady && (
            <span className="video-play-overlay" aria-hidden="true">
              <Play size={isMobileViewport ? 16 : 22} fill="currentColor" />
            </span>
          )}

          <span className="video-open">
            <ArrowUpRight size={16} />
          </span>
          <span className="video-index">OPEN VIDEO</span>
        </div>
      </div>

      <div className="video-meta">
        <div className="video-meta-text">
          <h3>{project.title}</h3>
          <p>{project.client ?? 'Independent project'}</p>
        </div>
        <span className="project-category">{project.category ?? 'VIDEO'}</span>
      </div>
    </article>
  );
}
