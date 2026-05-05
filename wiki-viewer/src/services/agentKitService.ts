import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { isValidFilePath } from '@/lib/validation';

export interface AgentKitStatus {
  generated: boolean;
  last_run: string | null;
  outputs: string[];
  files: string[];
}

export interface AgentKitFile {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
}

export interface AgentKitFilesResponse {
  files: AgentKitFile[];
  stats: { total_files: number; total_size: number } | null;
}

export interface GenerateOptions {
  target: 'all' | 'mcp' | 'skill';
  package?: boolean;
  incremental?: boolean;
  skipDiagrams?: boolean;
}

export interface GenerateResult {
  success: boolean;
  stdout: string;
  stderr: string;
  returncode: number;
}

export async function fetchAgentKitStatus(): Promise<AgentKitStatus> {
  const res = await fetchWithTimeout('/api/agent-kit/status', { timeoutMs: 10000 });
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`);
  return res.json();
}

export async function generateAgentKit(options: GenerateOptions): Promise<GenerateResult> {
  const res = await fetchWithTimeout('/api/agent-kit/generate', { timeoutMs: 300000, 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(`Generation request failed: ${res.status}`);
  return res.json();
}

export async function fetchAgentKitFiles(path: string = '', recursive: boolean = false): Promise<AgentKitFilesResponse> {
  if (path && !isValidFilePath(path)) throw new Error('Invalid file path');
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  if (recursive) params.set('recursive', '1');
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithTimeout(`/api/agent-kit/files${query}`, { timeoutMs: 10000 });
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export function downloadAgentKitFile(path: string): void {
  if (!isValidFilePath(path)) throw new Error('Invalid file path');
  const url = `/api/agent-kit/download?path=${encodeURIComponent(path)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadAgentKitZip(paths: string[]): Promise<void> {
  const res = await fetchWithTimeout('/api/agent-kit/download-zip', { timeoutMs: 60000, 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent-kit.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
