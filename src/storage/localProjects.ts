import type { VideoProject } from '../data/projects';

const STORAGE_KEY = 'creator-portfolio-tiktok-projects-v1';

export type StoredProject = {
  project: VideoProject;
  createdAt: number;
};

function readRecords(): StoredProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is StoredProject => Boolean(item && item.project && typeof item.project.id === 'string'));
  } catch {
    return [];
  }
}

export async function saveLocalProject(record: StoredProject): Promise<void> {
  const records = readRecords().filter(item => item.project.id !== record.project.id);
  records.push(record);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export async function getLocalProjects(): Promise<VideoProject[]> {
  return readRecords().sort((a, b) => a.createdAt - b.createdAt).map(item => item.project);
}

export async function deleteLocalProject(id: string): Promise<void> {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readRecords().filter(item => item.project.id !== id)));
}

export async function getStoredProjects(): Promise<StoredProject[]> {
  return readRecords().sort((a, b) => b.createdAt - a.createdAt);
}
