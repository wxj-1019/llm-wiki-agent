import { FileText, Users, Lightbulb, Layers } from 'lucide-react';

export type Tab = 'search' | 'web' | 'chat' | 'generate';

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { path: string; preview: string }[];
  error?: boolean;
  timestamp?: number;
}

export const typeIcons: Record<string, React.ElementType> = {
  source: FileText,
  entity: Users,
  concept: Lightbulb,
  synthesis: Layers,
};

export const typeColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10',
  entity: 'text-apple-green bg-apple-green/10',
  concept: 'text-apple-purple bg-apple-purple/10',
  synthesis: 'text-apple-orange bg-apple-orange/10',
};

export const typeTagColors: Record<string, string> = {
  source: 'text-apple-blue bg-apple-blue/10 border-apple-blue/20',
  entity: 'text-apple-green bg-apple-green/10 border-apple-green/20',
  concept: 'text-apple-purple bg-apple-purple/10 border-apple-purple/20',
  synthesis: 'text-apple-orange bg-apple-orange/10 border-apple-orange/20',
};
