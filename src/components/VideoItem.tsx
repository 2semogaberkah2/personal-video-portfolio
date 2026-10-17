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
  const [videoFailed, setVideoFailed] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);
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

  const previewUrl = project.previewVideo || project.fullVideo;
  const canPreviewMp4 =
    !tiktokEmbed && Boolean(previewUrl) && !videoFailed;
  const isActive = activePreview === project.id;

  useEffect(() => {
    activePreviewRef.current = activePreview;
  }, [activePreview]);

  useEffect(() => {
    const query = window.matchMedia(
      '(hover: hover) and (pointer: fine)'
    );

    const updateDevice = () => setTouchDevice(!query.matches);
    updateDevice();
    query.addEventListener('change', updateDevice);

    return () => query.removeEventListener('change', updateDevice);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !touchDevice || !canPreviewMp4) return;

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
  }, [touchDevice, canPreviewMp4, project.id, onPreview]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      if (video.paused) {
        setIsBuffering(true);
        video.play().catch(() => {
          setIsBuffering(false);
          // Browser may block autoplay until the user interacts.
        });
      }
    } else {
      video.pause();
      video.currentTime = 0;
      setIsBuffering(false);
      setShowSlowHint(false);
    }
  }, [isActive]);

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
      video.play().catch(() => {
        // Playback can be retried by the user.
      });
    }
  };

  return (
    <article
      className="video-item-card"
      onMouseEnter={() => {
        if (!touchDevice && canPreviewMp4) onPreview(project.id);
      }}
      onMouseLeave={() => {
        if (!touchDevice && canPreviewMp4 && isActive) {
          onPreview(null);
        }
      }}
      onFocus={() => {
        if (!touchDevice && canPreviewMp4) onPreview(project.id);
      }}
      onBlur={(event) => {
        if (
          !touchDevice &&
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
        {tiktokEmbed ? (
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
              preload={isActive ? "auto" : "none"}
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
            {!imageFailed && project.thumbnail && (
              <img
                className="video-poster"
                src={project.thumbnail}
                alt={`Thumbnail ${project.title}`}
                loading="lazy"
                onError={() => setImageFailed(true)}
                style={{
                  objectPosition: project.posterPosition ?? 'center',
                }}
              />
            )}
            {(imageFailed || !project.thumbnail) && (
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




