import { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { coverHue } from '../lib/cover';

export interface CoverImageProps {
  candidates: string[];
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  priority?: boolean;
  objectPosition?: string;
  showPlayIcon?: boolean;
}

export function CoverImage({
  candidates,
  id,
  title,
  subtitle,
  category,
  priority = false,
  objectPosition = 'center',
  showPlayIcon = false,
}: CoverImageProps) {
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const cleanCandidates = candidates
    .map((c) => (c || '').trim())
    .filter((c) => Boolean(c) && (/^https?:\/\//i.test(c) || c.startsWith('/')));

  const candidateKey = `${id}::${cleanCandidates.join('|')}`;

  useEffect(() => {
    setCandidateIdx(0);
    setIsLoaded(false);
  }, [candidateKey, id]);

  const currentSrc = cleanCandidates[candidateIdx] || '';
  const hasExhausted = candidateIdx >= cleanCandidates.length;

  const hue = coverHue(id);

  return (
    <div className="cover-layer" aria-hidden="true">
      {/* Layer 0 (L0): CoverPlaceholder selalu termount dengan branded gradient & tint */}
      <div
        className="cover-placeholder"
        style={{
          background: `radial-gradient(circle at 18% 18%, rgba(37, 244, 238, 0.16), transparent 55%), radial-gradient(circle at 82% 82%, rgba(255, 43, 85, 0.16), transparent 55%), linear-gradient(145deg, hsl(${hue}, 48%, 14%) 0%, #0d0d0d 65%, hsl(${(hue + 45) % 360}, 40%, 10%) 100%)`,
        }}
      >
        {showPlayIcon && (
          <span className="cover-placeholder-icon">
            <Play size={18} fill="currentColor" />
          </span>
        )}
        <span className="cover-placeholder-title">{title}</span>
        {(subtitle || category) && (
          <small className="cover-placeholder-sub">
            {subtitle ? `${subtitle} · ` : ''}
            {category || 'VIDEO'}
          </small>
        )}
      </div>

      {/* Layer 1 (L1): Gambar Thumbnail Asli */}
      {!hasExhausted && currentSrc ? (
        <img
          key={currentSrc}
          className={isLoaded ? 'cover-img is-loaded' : 'cover-img'}
          src={currentSrc}
          alt={`Cover ${title}`}
          referrerPolicy="no-referrer"
          decoding="async"
          loading={priority ? 'eager' : 'lazy'}
          style={{ objectPosition }}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 1) {
              setIsLoaded(true);
            } else {
              setCandidateIdx((prev) => prev + 1);
            }
          }}
          onError={() => {
            setCandidateIdx((prev) => prev + 1);
          }}
        />
      ) : null}
    </div>
  );
}
