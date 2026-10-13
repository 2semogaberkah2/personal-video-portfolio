export type VideoProject = {
  id: string;
  title: string;
  client?: string;
  category?: string;
  thumbnail: string;
  previewVideo?: string;
  fullVideo?: string;
  externalUrl?: string;
  tiktokUrl?: string;
  tiktokVideoId?: string;
  description?: string;
  role?: string;
  featured?: boolean;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  posterPosition?: string;
  /** Set true only when the thumbnail/video files are ready and the project is approved for public display. */
  published?: boolean;
};

// Replace these examples with verified project details and real media files.
// Unpublished projects are intentionally hidden from the public gallery.
export const projects: VideoProject[] = [
  { id: 'project-one', title: 'Project title', client: 'Brand / Client', category: 'TikTok Content', thumbnail: '/assets/images/thumbnails/project-one.webp', previewVideo: '/assets/videos/previews/project-one.mp4', fullVideo: '/assets/videos/full/project-one.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', featured: true, published: false },
  { id: 'project-two', title: 'Project title', client: 'Brand / Client', category: 'Food & Beverage', thumbnail: '/assets/images/thumbnails/project-two.webp', previewVideo: '/assets/videos/previews/project-two.mp4', fullVideo: '/assets/videos/full/project-two.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', published: false },
  { id: 'project-three', title: 'Project title', client: 'Brand / Client', category: 'Product Video', thumbnail: '/assets/images/thumbnails/project-three.webp', previewVideo: '/assets/videos/previews/project-three.mp4', fullVideo: '/assets/videos/full/project-three.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', published: false },
  { id: 'project-four', title: 'Project title', client: 'Brand / Client', category: 'Promotional Video', thumbnail: '/assets/images/thumbnails/project-four.webp', previewVideo: '/assets/videos/previews/project-four.mp4', fullVideo: '/assets/videos/full/project-four.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', published: false },
  { id: 'project-five', title: 'Project title', client: 'Brand / Client', category: 'Affiliate Content', thumbnail: '/assets/images/thumbnails/project-five.webp', previewVideo: '/assets/videos/previews/project-five.mp4', fullVideo: '/assets/videos/full/project-five.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', published: false },
  { id: 'project-six', title: 'Project title', client: 'Brand / Client', category: 'Brand Content', thumbnail: '/assets/images/thumbnails/project-six.webp', previewVideo: '/assets/videos/previews/project-six.mp4', fullVideo: '/assets/videos/full/project-six.mp4', description: 'Tambahkan deskripsi singkat tentang konsep dan tujuan video.', role: 'Tambahkan kontribusi yang benar-benar dikerjakan.', published: false },
];
