import { FileText, FileSpreadsheet, FileCode, FileArchive, FileImage, FileType } from 'lucide-react';

export type FileTypeFilter = 'all' | 'document' | 'spreadsheet' | 'code' | 'other';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return FileSpreadsheet;
  if (['json', 'yaml', 'yml', 'xml', 'html', 'htm', 'ipynb'].includes(ext)) return FileCode;
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) return FileArchive;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return FileImage;
  if (['pdf', 'docx', 'pptx', 'rtf', 'epub', 'rst'].includes(ext)) return FileType;
  return FileText;
}

export function getFileCategory(name: string): FileTypeFilter {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['md', 'txt', 'pdf', 'docx', 'pptx', 'rtf', 'epub', 'rst'].includes(ext)) return 'document';
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) return 'spreadsheet';
  if (['json', 'yaml', 'yml', 'xml', 'html', 'htm', 'ipynb'].includes(ext)) return 'code';
  return 'other';
}

export function getFileTypeColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'text-red-500';
  if (['docx', 'doc'].includes(ext)) return 'text-blue-500';
  if (['xlsx', 'xls'].includes(ext)) return 'text-green-500';
  if (['pptx', 'ppt'].includes(ext)) return 'text-orange-500';
  if (['md', 'txt'].includes(ext)) return 'text-slate-500';
  if (['py', 'js', 'ts', 'json', 'yaml', 'yml'].includes(ext)) return 'text-purple-500';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'text-amber-500';
  return 'text-[var(--text-tertiary)]';
}

export function getFileTypeBg(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'bg-red-500/8';
  if (['docx', 'doc'].includes(ext)) return 'bg-blue-500/8';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'bg-emerald-500/8';
  if (['md', 'txt'].includes(ext)) return 'bg-apple-blue/8';
  if (['json', 'yaml', 'yml'].includes(ext)) return 'bg-amber-500/8';
  if (['zip', 'tar', 'gz'].includes(ext)) return 'bg-violet-500/8';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'bg-pink-500/8';
  return 'bg-[var(--bg-tertiary)]';
}
