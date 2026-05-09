import { create } from 'zustand';

export interface IngestJob {
  id: string;
  path: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
  logs: string[];
  progress: number;
  returncode?: number;
  createdAt: number;
  updatedAt: number;
}

interface IngestState {
  jobs: IngestJob[];
  startJob: (path: string, name: string) => string;
  updateJob: (id: string, partial: Partial<IngestJob>) => void;
  dismissJob: (id: string) => void;
  dismissAllCompleted: () => void;
}

const STORAGE_KEY = 'wiki-ingest-jobs';

function loadJobs(): IngestJob[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: IngestJob[] = JSON.parse(raw);
      // Mark running jobs as failed since we lost the SSE connection
      return parsed.map((j) =>
        j.status === 'running'
          ? { ...j, status: 'failed', logs: [...j.logs, 'Connection lost due to page navigation'] }
          : j
      );
    }
  } catch { /* localStorage unavailable */ }
  return [];
}

function persist(jobs: IngestJob[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch { /* localStorage unavailable */ }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useIngestStore = create<IngestState>((set, get) => ({
  jobs: loadJobs(),

  startJob: (path, name) => {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const job: IngestJob = {
      id,
      path,
      name,
      status: 'running',
      logs: ['Starting ingest...'],
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => {
      const jobs = [...state.jobs.filter((j) => j.id !== id), job];
      persist(jobs);
      return { jobs };
    });
    return id;
  },

  updateJob: (id, partial) => {
    set((state) => {
      const jobs = state.jobs.map((j) =>
        j.id === id ? { ...j, ...partial, updatedAt: Date.now() } : j
      );
      persist(jobs);
      return { jobs };
    });
  },

  dismissJob: (id) => {
    set((state) => {
      const jobs = state.jobs.filter((j) => j.id !== id);
      persist(jobs);
      return { jobs };
    });
  },

  dismissAllCompleted: () => {
    set((state) => {
      const jobs = state.jobs.filter((j) => j.status !== 'completed');
      persist(jobs);
      return { jobs };
    });
  },
}));
