import { formatDistanceToNow as _formatDistanceToNow } from 'date-fns';
import i18n from '@/i18n';

export function formatDistanceToNow(date: number | Date): string {
  try {
    return _formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return i18n.t('common.unknownTime', 'Unknown time');
  }
}
