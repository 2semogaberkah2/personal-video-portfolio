import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Play } from 'lucide-react';
import { projects as bundledProjects, type VideoProject } from '../data/projects';
import { getPublishedPortfolioVideos } from '../lib/portfolioVideos';
import VideoItem from './VideoItem';
import VideoModal from './VideoModal';

const INITIAL_VISIBLE_COUNT = 9;

export default function VideoFeed() {
  const [selected, setSelected] = useState<VideoProject | null>(null);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<VideoProject[]>([]);
  const [loadError, setLoadError] = useState('');
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const closeModal = useCallback(() => setSelected(null), []);

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

  const hasMoreProjects = visibleProjects.length > INITIAL_VISIBLE_COUNT;
  const displayedProjects = showAll
    ? visibleProjects
    : visibleProjects.slice(0, INITIAL_VISIBLE_COUNT);

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
          {String(displayedProjects.length).padStart(2, '0')} / {String(visibleProjects.length).padStart(2, '0')} PROJECTS
        </span>
      </div>

      {visibleProjects.length > 0 ? (
        <>
          <div className="video-grid">
            {displayedProjects.map((project) => (
              <VideoItem
                key={project.id}
                project={project}
                onOpen={setSelected}
                onPreview={setActivePreview}
                activePreview={activePreview}
              />
            ))}
          </div>

          {hasMoreProjects && (
            <div className="video-feed-more-wrap">
              <button
                type="button"
                className="video-feed-more-btn"
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll ? (
                  <>
                    TAMPILKAN 9 KARYA UTAMA <ChevronUp size={16} />
                  </>
                ) : (
                  <>
                    LIHAT SEMUA KARYA ({visibleProjects.length} VIDEO) <ChevronDown size={16} />
                  </>
                )}
              </button>
            </div>
          )}
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

      <VideoModal
        project={selected}
        projects={visibleProjects}
        onClose={closeModal}
      />
    </section>
  );
}
