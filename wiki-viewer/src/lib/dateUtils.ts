import { formatDistanceToNow as _formatDistanceToNow } from 'date-fns';

export function formatDistanceToNow(date: number | Date): string {
  try {
    return _formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}
