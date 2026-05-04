/**
 * Client-side input validation utilities.
 */

const PATH_TRAVERSAL_PATTERN = /\.\.(\\|\/)/;
const NULL_BYTE_PATTERN = /\0/;

export function isValidFilePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (path.length > 4096) return false;
  // Decode URL-encoded path traversal first
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  if (PATH_TRAVERSAL_PATTERN.test(decoded)) return false;
  if (NULL_BYTE_PATTERN.test(decoded)) return false;
  return true;
}

export function isValidFileName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.length > 255) return false;
  if (/[<>:"|?*\0]/.test(name)) return false;
  if (name.trim() === '.' || name.trim() === '..') return false;
  return true;
}

export function sanitizePath(path: string): string {
  const sanitized = path
    .replace(/\.\.(\\|\/)/g, '')
    .replace(/\0/g, '')
    .replace(/[<>":|?*]/g, '_')
    .trim();
  return sanitized || '_';
}
