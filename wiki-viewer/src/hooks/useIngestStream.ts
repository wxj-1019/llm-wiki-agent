import { useEffect } from 'react';
import { useIngestStore } from '@/stores/ingestStore';

const activeConnections = new Map<string, EventSource>();

export function connectIngestStream(jobId: string, path: string) {
  if (activeConnections.has(jobId)) return;

  const es = new EventSource(`/api/ingest/stream?path=${encodeURIComponent(path)}`);
  activeConnections.set(jobId, es);

  const updateJob = useIngestStore.getState().updateJob;

  es.addEventListener('start', () => {
    updateJob(jobId, { status: 'running', logs: ['Connected, starting ingest...'] });
  });

  es.addEventListener('log', (e) => {
    try {
      const { text, progress } = JSON.parse((e as MessageEvent).data);
      const current = useIngestStore.getState().jobs.find((j) => j.id === jobId);
      updateJob(jobId, {
        logs: [...(current?.logs || []), text],
        progress,
      });
    } catch {
      // ignore parse error
    }
  });

  es.addEventListener('stderr', (e) => {
    try {
      const { text } = JSON.parse((e as MessageEvent).data);
      const current = useIngestStore.getState().jobs.find((j) => j.id === jobId);
      updateJob(jobId, {
        logs: [...(current?.logs || []), `stderr: ${text}`],
      });
    } catch {
      // ignore parse error
    }
  });

  es.addEventListener('complete', (e) => {
    try {
      const { status, returncode } = JSON.parse((e as MessageEvent).data);
      es.close();
      activeConnections.delete(jobId);
      updateJob(jobId, { status, progress: 100, returncode });
    } catch {
      // ignore parse error
    }
  });

  es.onerror = () => {
    es.close();
    activeConnections.delete(jobId);
    const current = useIngestStore.getState().jobs.find((j) => j.id === jobId);
    if (current && current.status === 'running') {
      updateJob(jobId, { status: 'failed' });
    }
  };
}

export function disconnectIngestStream(jobId: string) {
  const es = activeConnections.get(jobId);
  if (es) {
    es.close();
    activeConnections.delete(jobId);
  }
}

export function useIngestStreamManager() {
  const jobs = useIngestStore((s) => s.jobs);

  useEffect(() => {
    const ownedIds = new Set<string>();
    const running = jobs.filter((j) => j.status === 'running');
    for (const job of running) {
      if (!activeConnections.has(job.id)) {
        connectIngestStream(job.id, job.path);
      }
      ownedIds.add(job.id);
    }
    return () => {
      for (const jobId of ownedIds) {
        const es = activeConnections.get(jobId);
        if (es) {
          es.close();
          activeConnections.delete(jobId);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { connect: connectIngestStream, disconnect: disconnectIngestStream };
}
