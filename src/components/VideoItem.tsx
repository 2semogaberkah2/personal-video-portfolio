import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { VideoProject } from '../data/projects';

type Props = {
  project: VideoProject;
  onOpen: (project: VideoProject) => void;
  onPreview: (id: string | null) => void;
  activePreview: string | null;
};

function sendTikTokCommand(iframe: HTMLIFrameElement | null, type: string, value?: unknown) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    { 'x-tiktok-player': true, type, value },
    '*'
  );
}

function sendYouTubeCommand(iframe: HTMLIFrameElement | null, func: string) {
  if (!iframe?.contentWindow) return;
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    '*'
  );
}

export default function VideoItem({
  project,
  onOpen,
  onPreview,
  activePreview,
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const [fallbackThumbUrl, setFallbackThumbUrl] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const activePreviewRef = useRef(activePreview);
  const isMutedRef = useRef(isMuted);

  const ratio =
    project.aspectRatio === '16:9'
      ? '16 / 9'
      : project.aspectRatio === '1:1'
        ? '1 / 1'
        : '9 / 16';

  const cleanTikTokParams =
    'controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&music_info=0&description=0&loop=1&rel=0&native_context_menu=0&closed_caption=0';

  const tiktokStaticEmbed = project.tiktokVideoId
    ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?autoplay=0&${cleanTikTokParams}`
    : null;

  const tiktokHoverEmbed = project.tiktokVideoId
    ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?autoplay=1&${cleanTikTokParams}`
    : null;

  const youtubeHoverEmbed = project.youtubeVideoId
    ? `https://www.youtube-nocookie.com/embed/${project.youtubeVideoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1&loop=1&playlist=${project.youtubeVideoId}`
    : null;

  const isYouTube = Boolean(project.youtubeVideoId);
  const isTikTok = Boolean(project.tiktokVideoId);

  const previewUrl = project.previewVideo || project.fullVideo;
  const canPreviewMp4 =
    !isTikTok && !isYouTube && Boolean(previewUrl) && !videoFailed;
  const canHoverPreview = canPreviewMp4 || isTikTok || isYouTube;
  const isActive = activePreview === project.id;

  useEffect(() => {
    activePreviewRef.current = activePreview;
  }, [activePreview]);

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

  // Ambil thumbnail TikTok langsung via oEmbed jika belum ada atau gagal
  useEffect(() => {
    if (!project.tiktokVideoId) return;
    if (project.thumbnail && ! project.thumbnail.startsWith('/api/') && !imageFailed) return;
    if (fallbackThumbUrl) return;

    let alive = true;
    const target =
      project.externalUrl ||
      `https://www.tiktok.com/@tiktok/video/${project.tiktokVideoId}`;
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { thumbnail_url?: string } | null) => {
        if (alive && data?.thumbnail_url) {
          setFallbackThumbUrl(data.thumbnail_url);
          setImageFailed(false);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [imageFailed, project.tiktokVideoId, project.externalUrl, project.thumbnail, fallbackThumbUrl]);

  // Kontrol pemutaran MP4 saat hover di laptop
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isMobileViewport || !canPreviewMp4) return;

    if (isActive) {
      if (video.paused) {
        setIsBuffering(true);
        video.muted = isMutedRef.current;
        video.play().catch(() => {
          setIsBuffering(false);
        });
      }
    } else {
      video.pause();
      video.currentTime = 0;
      setIsBuffering(false);
      setShowSlowHint(false);
    }
  }, [isActive, isMobileViewport, canPreviewMp4]);

  // Sinkronisasi postMessage untuk TikTok / YouTube saat hover di laptop
  useEffect(() => {
    if (!isActive || isMobileViewport || (!isTikTok && !isYouTube)) return;

    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const data = event.data as { 'x-tiktok-player'?: boolean; type?: string } | null;
      if (data && data['x-tiktok-player'] && data.type === 'onPlayerReady') {
        sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokCommand(iframeRef.current, 'play');
      }
    };

    window.addEventListener('message', handleMessage);

    const timer = window.setTimeout(() => {
      if (isTikTok) {
        sendTikTokCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendTikTokCommand(iframeRef.current, 'play');
      } else if (isYouTube) {
        sendYouTubeCommand(iframeRef.current, isMutedRef.current ? 'mute' : 'unMute');
        sendYouTubeCommand(iframeRef.current, 'playVideo');
      }
    }, 650);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timer);
    };
  }, [isActive, isMobileViewport, isTikTok, isYouTube]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;

    if (isActive && !isMobileViewport) {
      if (isTikTok) {
        sendTikTokCommand(iframeRef.current, isMuted ? 'mute' : 'unMute');
      } else if (isYouTube) {
        sendYouTubeCommand(iframeRef.current, isMuted ? 'mute' : 'unMute');
      }
    }
  }, [isMuted, isActive, isMobileViewport, isTikTok, isYouTube]);

  useEffect(() => {
    if (!isActive || !isBuffering) {
      setShowSlowHint(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowSlowHint(true);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [isActive, isBuffering]);

  // Reset mute ke true saat kursor keluar dari kartu
  useEffect(() => {
    if (!isActive) {
      setIsMuted(true);
    }
  }, [isActive]);

  const toggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (!isActive && !isMobileViewport) {
      onPreview(project.id);
    }

    if (canPreviewMp4 && videoRef.current) {
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

  const displayThumbnail = fallbackThumbUrl || project.thumbnail;
  const showDesktopHoverEmbed = !isMobileViewport && !touchDevice && isActive;

  return (
    <article
      className="video-item-card"
      onMouseEnter={() => {
        if (!touchDevice && !isMobileViewport && canHoverPreview) {
          onPreview(project.id);
        }
      }}
      onMouseLeave={() => {
        if (!touchDevice && !isMobileViewport && canHoverPreview && isActive) {
          onPreview(null);
        }
      }}
      onFocus={() => {
        if (!touchDevice && !isMobileViewport && canHoverPreview) {
          onPreview(project.id);
        }
      }}
      onBlur={(event) => {
        if (
          !touchDevice &&
          !isMobileViewport &&
          canHoverPreview &&
          isActive &&
          !event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          onPreview(null);
        }
      }}
    >
      <div
        ref={frameRef}
        className="video-frame"
        style={{ aspectRatio: ratio }}
      >
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
          {canPreviewMp4 ? (
            <>
              <video
                ref={videoRef}
                className="video-poster"
                src={showDesktopHoverEmbed ? previewUrl : `${previewUrl}#t=0.1`}
                muted={isMuted}
                loop
                playsInline
                preload="metadata"
                poster={!imageFailed && displayThumbnail ? displayThumbnail : undefined}
                onLoadedData={(e) => {
                  if (!showDesktopHoverEmbed) {
                    try {
                      e.currentTarget.currentTime = 0.1;
                    } catch {
                      // ignore seek error
                    }
                  }
                }}
                onLoadStart={() => {
                  if (activePreviewRef.current === project.id && !isMobileViewport) {
                    setIsBuffering(true);
                  }
                }}
                onWaiting={() => {
                  if (!isMobileViewport) setIsBuffering(true);
                }}
                onPlaying={() => {
                  setIsBuffering(false);
                  setShowSlowHint(false);
                }}
                onCanPlay={() => setIsBuffering(false)}
                onError={() => {
                  setVideoFailed(true);
                  setIsBuffering(false);
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />

              {showDesktopHoverEmbed && isBuffering && !videoFailed && (
                <div className="video-loading-indicator" role="status">
                  <span className="video-loading-spinner" />
                  <span>
                    {showSlowHint
                      ? 'Koneksi lambat? Video masih dimuat.'
                      : 'Menyiapkan video…'}
                  </span>
                </div>
              )}
            </>
          ) : showDesktopHoverEmbed && isTikTok && tiktokHoverEmbed ? (
            <iframe
              ref={iframeRef}
              className="video-tiktok-embed"
              title={`Preview TikTok: ${project.title}`}
              src={tiktokHoverEmbed}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
              style={{ pointerEvents: 'none' }}
            />
          ) : showDesktopHoverEmbed && isYouTube && youtubeHoverEmbed ? (
            <iframe
              ref={iframeRef}
              className="video-tiktok-embed"
              title={`Preview YouTube: ${project.title}`}
              src={youtubeHoverEmbed}
              allow="autoplay; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              tabIndex={-1}
              style={{ pointerEvents: 'none' }}
            />
          ) : !imageFailed && displayThumbnail ? (
            <img
              className="video-poster"
              src={displayThumbnail}
              alt={`Thumbnail ${project.title}`}
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              style={{
                objectPosition: project.posterPosition ?? 'center',
              }}
            />
          ) : tiktokStaticEmbed ? (
            <div className="mobile-tiktok-scaled-wrap" aria-hidden="true">
              <iframe
                className="mobile-tiktok-scaled-iframe"
                title={`Thumbnail TikTok: ${project.title}`}
                src={tiktokStaticEmbed}
                referrerPolicy="strict-origin-when-cross-origin"
                tabIndex={-1}
              />
            </div>
          ) : (
            <div className="asset-placeholder">
              <span className="placeholder-icon">
                <Play size={18} />
              </span>
              <span>{project.title}</span>
              <small>{project.client ?? project.category ?? 'VIDEO'}</small>
            </div>
          )}

          {/* Tombol Mute/Unmute tampil di Laptop saat card sedang di-hover / aktif */}
          {!isMobileViewport && canHoverPreview && (
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

          {!showDesktopHoverEmbed && (
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
        <span className="project-category">
          {project.category ?? 'VIDEO'}
        </span>
      </div>
    </article>
  );
}
