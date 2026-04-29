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
  const res = await fetch('/api/agent-kit/status');
  if (!res.ok) throw new Error(`Failed to fetch status: ${res.status}`);
  return res.json();
}

export async function generateAgentKit(options: GenerateOptions): Promise<GenerateResult> {
  const res = await fetch('/api/agent-kit/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!res.ok) throw new Error(`Generation request failed: ${res.status}`);
  return res.json();
}

export async function fetchAgentKitFiles(path: string = ''): Promise<AgentKitFilesResponse> {
  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  const res = await fetch(`/api/agent-kit/files${query}`);
  if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
  return res.json();
}

export function downloadAgentKitFile(path: string): void {
  const url = `/api/agent-kit/download?path=${encodeURIComponent(path)}`;
  window.open(url, '_blank');
}

export async function downloadAgentKitZip(paths: string[]): Promise<void> {
  const res = await fetch('/api/agent-kit/download-zip', {
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
  URL.revokeObjectURL(url);
}
