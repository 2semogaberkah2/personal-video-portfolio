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
  const frameRef = useRef<HTMLDivElement>(null);
  const activePreviewRef = useRef(activePreview);

  const ratio =
    project.aspectRatio === '16:9'
      ? '16 / 9'
      : project.aspectRatio === '1:1'
        ? '1 / 1'
        : '9 / 16';

  const tiktokEmbed = project.tiktokVideoId
    ? `https://www.tiktok.com/player/v1/${project.tiktokVideoId}?music_info=1&description=1`
    : null;
  const isYouTube = Boolean(project.youtubeVideoId);

  const previewUrl = project.previewVideo || project.fullVideo;
  const canPreviewMp4 =
    !tiktokEmbed && !isYouTube && Boolean(previewUrl) && !videoFailed;
  const isActive = activePreview === project.id;

  useEffect(() => {
    activePreviewRef.current = activePreview;
  }, [activePreview]);

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

  // Fallback client-side oEmbed jika /api/tiktok-thumb belum tersedia
  useEffect(() => {
    if (!imageFailed || !project.tiktokVideoId || fallbackThumbUrl) return;
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
  }, [imageFailed, project.tiktokVideoId, project.externalUrl, fallbackThumbUrl]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !touchDevice || isMobileViewport || !canPreviewMp4) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
          onPreview(project.id);
        } else if (activePreviewRef.current === project.id) {
          onPreview(null);
        }
      },
      { threshold: [0, 0.4, 0.65, 0.85, 1] }
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, [touchDevice, isMobileViewport, canPreviewMp4, project.id, onPreview]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || isMobileViewport) return;

    if (isActive) {
      if (video.paused) {
        setIsBuffering(true);
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
  }, [isActive, isMobileViewport]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

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

  const toggleMute = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const video = videoRef.current;
    if (!video) return;

    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);

    if (!nextMuted && !isActive) {
      onPreview(project.id);
    } else if (!nextMuted && video.paused) {
      video.play().catch(() => {});
    }
  };

  const displayThumbnail = fallbackThumbUrl || project.thumbnail;

  return (
    <article
      className="video-item-card"
      onMouseEnter={() => {
        if (!touchDevice && !isMobileViewport && canPreviewMp4) onPreview(project.id);
      }}
      onMouseLeave={() => {
        if (!touchDevice && !isMobileViewport && canPreviewMp4 && isActive) {
          onPreview(null);
        }
      }}
      onFocus={() => {
        if (!touchDevice && !isMobileViewport && canPreviewMp4) onPreview(project.id);
      }}
      onBlur={(event) => {
        if (
          !touchDevice &&
          !isMobileViewport &&
          canPreviewMp4 &&
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
        {isMobileViewport ? (
          <button
            type="button"
            className="video-card-fallback mobile-grid-tile"
            onClick={() => onOpen(project)}
            aria-label={`Buka video ${project.title}`}
          >
            {!imageFailed && displayThumbnail ? (
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
            ) : canPreviewMp4 && previewUrl ? (
              <video
                className="video-poster"
                src={`${previewUrl}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                onLoadedData={(e) => {
                  try {
                    e.currentTarget.currentTime = 0.1;
                  } catch {
                    // ignore seek error
                  }
                }}
                onError={() => setVideoFailed(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            ) : tiktokEmbed ? (
              <div className="mobile-tiktok-scaled-wrap" aria-hidden="true">
                <iframe
                  className="mobile-tiktok-scaled-iframe"
                  title={`Video TikTok: ${project.title}`}
                  src={tiktokEmbed}
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
              </div>
            )}
            <span className="video-play-overlay" aria-hidden="true">
              <Play size={16} fill="currentColor" />
            </span>
          </button>
        ) : isYouTube ? (
          <button
            type="button"
            className="video-card-fallback"
            onClick={() => onOpen(project)}
            aria-label={`Putar video YouTube ${project.title}`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
              padding: 0,
              background: '#080808',
              cursor: 'pointer',
            }}
          >
            {project.thumbnail && (
              <img
                src={project.thumbnail}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <span className="video-play-overlay" aria-hidden="true">
              <Play size={25} fill="currentColor" />
            </span>
          </button>
        ) : tiktokEmbed ? (
          <iframe
            className="video-tiktok-embed"
            title={`Video TikTok: ${project.title}`}
            src={tiktokEmbed}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : canPreviewMp4 ? (
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
            <video
              ref={videoRef}
              className="video-poster"
              src={isActive ? previewUrl : undefined}
              muted={isMuted}
              loop
              playsInline
              preload={isActive ? 'auto' : 'none'}
              poster={project.thumbnail || undefined}
              onLoadStart={() => {
                if (activePreviewRef.current === project.id) {
                  setIsBuffering(true);
                }
              }}
              onWaiting={() => setIsBuffering(true)}
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
              }}
            />

            {isActive && isBuffering && !videoFailed && (
              <div className="video-loading-indicator" role="status">
                <span className="video-loading-spinner" />
                <span>
                  {showSlowHint
                    ? 'Koneksi lambat? Video masih dimuat.'
                    : 'Menyiapkan video…'}
                </span>
              </div>
            )}

            <button
              type="button"
              className="video-volume-toggle"
              onClick={toggleMute}
              aria-label={isMuted ? 'Aktifkan suara' : 'Matikan suara'}
              title={isMuted ? 'Aktifkan suara' : 'Matikan suara'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <span className="video-open">
              <ArrowUpRight size={18} />
            </span>
            <span className="video-index">OPEN VIDEO</span>
          </div>
        ) : (
          <button
            type="button"
            className="video-card-fallback"
            onClick={() => onOpen(project)}
            aria-label={`Buka video ${project.title}`}
          >
            {!imageFailed && displayThumbnail && (
              <img
                className="video-poster"
                src={displayThumbnail}
                alt={`Thumbnail ${project.title}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                style={{
                  objectPosition: project.posterPosition ?? 'center',
                }}
              />
            )}
            {(imageFailed || !displayThumbnail) && (
              <div className="asset-placeholder">
                <span className="placeholder-icon">
                  <Play size={18} />
                </span>
                <span>VIDEO PROJECT</span>
                <small>{project.client ?? project.id}</small>
              </div>
            )}
            <span className="video-open">
              <ArrowUpRight size={18} />
            </span>
            <span className="video-index">OPEN VIDEO</span>
          </button>
        )}
      </div>

      <div className="video-meta">
        <div>
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
