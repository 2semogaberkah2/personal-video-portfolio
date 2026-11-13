import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, Volume2, VolumeX, Play } from 'lucide-react';
import type { VideoProject } from '../data/projects';
import { CoverImage } from './CoverImage';
import { buildCoverCandidates } from '../lib/cover';

export type VideoItemProps = {
  project: VideoProject;
  activePreview: string | null;
  onPreview: (id: string | null) => void;
  onOpen: (project: VideoProject) => void;
  index: number;
};

function sendYouTubeCommand(iframe: HTMLIFrameElement | null, command: string, args: unknown[] = []) {
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: command, args }),
      '*'
    );
  } catch {
    // Ignore cross-origin issues
  }
}

function sendTikTokCommand(iframe: HTMLIFrameElement | null, action: string, value?: unknown) {
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      {
        'x-tiktok-player': true,
        type: action,
        value,
      },
      '*'
    );
  } catch {
    // Ignore cross-origin issues
  }
}

export function VideoItem({
  project,
  activePreview,
  onPreview,
  onOpen,
  index,
}: VideoItemProps) {
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
    ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?autoplay=1&muted=1&${cleanTikTokParams}`
    : null;

  const youtubeHoverEmbed = project.youtubeVideoId
    ? `https://www.youtube-nocookie.com/embed/${project.youtubeVideoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1&loop=1&playlist=${project.youtubeVideoId}`
    : null;

  const isActive = activePreview === project.id;
  // Di laptop (>600px), izinkan live hover preview baik dengan mouse maupun laptop touchscreen
  const canLive = !isMobileViewport && isActive && (isMp4 || isTikTok || isYouTube);

  const candidates = useMemo(() => {
    return buildCoverCandidates({
      thumbnailPath: project.thumbnail,
      tiktokId: project.tiktokVideoId,
      tiktokUrl: project.fullVideo,
      youtubeId: project.youtubeVideoId,
      customThumbnails: project.thumbnailFallbacks,
    });
  }, [
    project.thumbnail,
    project.tiktokVideoId,
    project.fullVideo,
    project.youtubeVideoId,
    project.thumbnailFallbacks,
  ]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 600px)');

    const updateDevice = () => {
      setIsMobileViewport(mobileQuery.matches);
    };
    updateDevice();

    mobileQuery.addEventListener('change', updateDevice);
    return () => {
      mobileQuery.removeEventListener('change', updateDevice);
    };
  }, []);

  // Hover-intent singkat (120ms) sebelum me-mount layer live desktop
  useEffect(() => {
    if (!canLive) {
      setMountLive(false);
      setLiveReady(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setMountLive(true);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canLive]);

  // Handler TikTok message & command trigger saat live layer desktop aktif
  useEffect(() => {
    if (!mountLive || !isTikTok) return;

    const triggerPlayback = () => {
      sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
      sendTikTokCommand(iframeRef.current, 'play');
      setLiveReady(true);
    };

    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as { 'x-tiktok-player'?: boolean; type?: string } | null;
      if (data && data['x-tiktok-player'] && data.type === 'onPlayerReady') {
        triggerPlayback();
      }
    };

    window.addEventListener('message', handleMessage);

    const t1 = window.setTimeout(triggerPlayback, 350);
    const t2 = window.setTimeout(triggerPlayback, 900);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [mountLive, isTikTok]);

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (isMp4 && videoRef.current) {
      videoRef.current.muted = nextMuted;
    } else if (isYouTube && iframeRef.current) {
      sendYouTubeCommand(iframeRef.current, nextMuted ? 'mute' : 'unMute');
    } else if (isTikTok && iframeRef.current) {
      sendTikTokCommand(iframeRef.current, nextMuted ? 'mute' : 'unMute');
    }
  };

  return (
    <article
      className="video-item-card"
      onMouseEnter={() => {
        if (!isMobileViewport) {
          onPreview(project.id);
        }
      }}
      onMouseLeave={() => {
        if (!isMobileViewport && isActive) {
          onPreview(null);
        }
      }}
      onFocus={() => {
        if (!isMobileViewport) {
          onPreview(project.id);
        }
      }}
      onBlur={(event) => {
        if (
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
          {/* Layer 1 (Dasar): Cover Gambar Murni (Tidak pernah live iframe di mobile) */}
          <CoverImage
            candidates={candidates}
            id={project.id}
            title={project.title}
            subtitle={project.client || undefined}
            category={project.category}
            priority={index < 3}
            objectPosition={project.posterPosition ?? 'center'}
          />

          {/* Layer 2: Live Player Desktop (Mount saat di-hover di laptop) */}
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
                  onLoadedData={() => setLiveReady(true)}
                  onPlaying={() => setLiveReady(true)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    pointerEvents: 'none',
                    zIndex: 4,
                  }}
                />
              )}

              {isTikTok && tiktokHoverEmbed && (
                <iframe
                  ref={iframeRef}
                  className={liveReady ? 'video-tiktok-embed is-ready' : 'video-tiktok-embed'}
                  title={`Preview TikTok: ${project.title}`}
                  src={tiktokHoverEmbed}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  tabIndex={-1}
                  onLoad={() => {
                    setLiveReady(true);
                    sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
                    sendTikTokCommand(iframeRef.current, 'play');
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                    pointerEvents: 'none',
                    zIndex: 4,
                  }}
                />
              )}

              {isYouTube && youtubeHoverEmbed && (
                <iframe
                  ref={iframeRef}
                  className={liveReady ? 'video-tiktok-embed is-ready' : 'video-tiktok-embed'}
                  title={`Preview YouTube: ${project.title}`}
                  src={youtubeHoverEmbed}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  tabIndex={-1}
                  onLoad={() => {
                    setLiveReady(true);
                    sendYouTubeCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
                    sendYouTubeCommand(iframeRef.current, 'playVideo');
                  }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    border: 0,
                    pointerEvents: 'none',
                    zIndex: 4,
                  }}
                />
              )}
            </>
          )}

          {/* Tombol Mute/Unmute Desktop */}
          {!isMobileViewport && isActive && (
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
          {project.client && <p>{project.client}</p>}
        </div>
        <span className="project-category">{project.category}</span>
      </div>
    </article>
  );
}

export default VideoItem;
