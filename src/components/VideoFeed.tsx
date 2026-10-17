
import { useCallback, useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { projects as bundledProjects, type VideoProject } from '../data/projects';
import { getPublishedPortfolioVideos } from '../lib/portfolioVideos';
import VideoItem from './VideoItem';
import VideoModal from './VideoModal';

export default function VideoFeed() {
  const [selected, setSelected] = useState<VideoProject | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<VideoProject[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const closeModal = useCallback(() => setSelected(null), []);

  const handleFeedScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const feed = event.currentTarget;
      const cards = Array.from(feed.children) as HTMLElement[];

      if (cards.length === 0) return;

      const feedCenter = feed.scrollLeft + feed.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const distance = Math.abs(cardCenter - feedCenter);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setCurrentIndex(closestIndex);
    },
    []
  );

  useEffect(() => {
    let alive = true;

    getPublishedPortfolioVideos()
      .then((items) => {
        if (alive) {
          setRemoteProjects(items);
          setLoadError('');
          setIsLoadingVideos(false);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setIsLoadingVideos(false);
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Video dari server belum dapat dimuat.'
          );
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  const visibleProjects = [
    ...remoteProjects,
    ...bundledProjects.filter(
      (project) =>
        project.published &&
        project.thumbnail &&
        project.title &&
        project.title !== 'Project title'
    ),
  ];

  return (
    <section className="work section-wrap" id="work">
      <div className="section-heading">
        <div>
          <span className="section-kicker">THE WORK</span>
          <h2>
            MADE TO BE <span>WATCHED.</span>
          </h2>
        </div>
        <span className="section-count">
          {String(visibleProjects.length).padStart(2, '0')} PROJECTS
        </span>
      </div>

      {visibleProjects.length > 0 ? (
        <>
          <div
            className="video-grid"
            onScroll={handleFeedScroll}
          >
            {visibleProjects.map((project) => (
              <VideoItem
                key={project.id}
                project={project}
                onOpen={setSelected}
                onPreview={setActivePreview}
                activePreview={activePreview}
              />
            ))}
          </div>

          <div className="mobile-feed-navigation" aria-live="polite">
            <span className="mobile-feed-count">
              {currentIndex + 1} / {visibleProjects.length}
            </span>

            <div className="mobile-feed-dots" aria-label="Posisi video">
              {visibleProjects.map((project, index) => (
                <button
                  key={project.id}
                  type="button"
                  className={
                    index === currentIndex
                      ? 'mobile-feed-dot is-active'
                      : 'mobile-feed-dot'
                  }
                  aria-label={`Lihat video ${index + 1}: ${project.title}`}
                  aria-current={index === currentIndex ? 'step' : undefined}
                  onClick={() => {
                    const feed = document.querySelector('.video-grid');
                    const card = feed?.children[index] as HTMLElement | undefined;

                    card?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'center',
                    });
                  }}
                />
              ))}
            </div>

            <span className="mobile-feed-hint">
              GESER UNTUK VIDEO LAIN <span aria-hidden="true">→</span>
            </span>
          </div>
        </>
      ) : isLoadingVideos ? null : (
        <div className="empty-work">
          <div className="empty-icon">
            <Play size={19} />
          </div>
          <div>
            <h3>YOUR WORK GOES HERE.</h3>
            <p>Belum ada video untuk ditampilkan.</p>
            {loadError && (
              <p role="status">
                Video belum dapat dimuat dari server. Periksa koneksi Supabase
                dan kebijakan aksesnya.
              </p>
            )}
          </div>
        </div>
      )}

      <VideoModal project={selected} onClose={closeModal} />
    </section>
  );
}





