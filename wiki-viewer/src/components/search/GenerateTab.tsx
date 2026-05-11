import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Plug, Loader2, Sparkles, Wand2, RotateCw, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateFromKnowledge } from '@/services/chatService';
import type { GenerateResult } from '@/services/chatService';
import { MarkdownRenderer } from '@/components/content/MarkdownRenderer';
import { useNotificationStore } from '@/stores/notificationStore';
import type { ChatEntry } from './types';

interface GenerateTabProps {
  query: string;
  chatEntries: ChatEntry[];
  onSwitchToGenerate: () => void;
}

type GenStage = 'searching' | 'extracting' | 'generating' | null;

export function GenerateTab({ query, chatEntries, onSwitchToGenerate }: GenerateTabProps) {
  const { t } = useTranslation();
  const addNotification = useNotificationStore(s => s.addNotification);

  const [genTarget, setGenTarget] = useState<'skill' | 'mcp'>('skill');
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genStage, setGenStage] = useState<GenStage>(null);
  const [editedCode, setEditedCode] = useState('');
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [refineInput, setRefineInput] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);

  const handleGenerate = useCallback(async (target: 'skill' | 'mcp') => {
    const genQuery = query.trim();
    if (!genQuery) {
      addNotification(t('chat.generateNoQuery', 'Please enter a query first'), 'info');
      return;
    }
    setGenTarget(target);
    setGenResult(null);
    setGenLoading(true);
    setGenStage('searching');
    setIsEditingCode(false);
    setEditedCode('');
    setRefineInput('');
    onSwitchToGenerate();
    try {
      await new Promise(r => setTimeout(r, 600));
      setGenStage('extracting');
      await new Promise(r => setTimeout(r, 400));
      setGenStage('generating');
      const history = chatEntries.map(e => ({ role: e.role, content: e.content }));
      const data = await generateFromKnowledge(genQuery, target, history);
      setGenResult(data);
      setEditedCode(data.code);
      setGenStage(null);
    } catch (err) {
      addNotification((err as Error).message, 'error');
      setGenStage(null);
    } finally {
      setGenLoading(false);
    }
  }, [query, chatEntries, addNotification, t, onSwitchToGenerate]);

  const handleRefine = useCallback(async () => {
    if (!refineInput.trim() || !genResult || refineLoading) return;
    setRefineLoading(true);
    setGenStage('generating');
    try {
      const history = chatEntries.map(e => ({ role: e.role, content: e.content }));
      history.push({ role: 'assistant', content: `Previous generated code:\n\`\`\`\n${genResult.code}\n\`\`\`` });
      const data = await generateFromKnowledge(refineInput, genTarget, history);
      setGenResult(data);
      setEditedCode(data.code);
      setRefineInput('');
      setGenStage(null);
    } catch (err) {
      addNotification((err as Error).message, 'error');
      setGenStage(null);
    } finally {
      setRefineLoading(false);
    }
  }, [refineInput, genResult, refineLoading, chatEntries, genTarget, addNotification]);

  const handleInstall = useCallback(async () => {
    if (!genResult) return;
    const code = isEditingCode ? editedCode : genResult.code;
    try {
      const endpoint = genTarget === 'mcp' ? '/api/mcp/install' : '/api/skills/install';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'generated', name: `generated-${genTarget}`, code }),
      });
      if (res.ok) addNotification(t('chat.installSuccess', 'Installed successfully'), 'success');
      else {
        const e = await res.text();
        addNotification(e || t('chat.installFailed', 'Installation failed'), 'error');
      }
    } catch (err) {
      addNotification((err as Error).message, 'error');
    }
  }, [genResult, isEditingCode, editedCode, genTarget, addNotification, t]);

  const handleDownload = useCallback(() => {
    const code = isEditingCode ? editedCode : genResult?.code;
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated.${genTarget === 'mcp' ? 'py' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [isEditingCode, editedCode, genResult, genTarget]);

  const STAGES = ['searching', 'extracting', 'generating'] as const;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setGenTarget('skill')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            genTarget === 'skill' ? 'bg-apple-purple/10 text-apple-purple border-apple-purple/30' : 'text-[var(--text-secondary)] border-[var(--border-default)] hover:border-apple-purple/20'
          }`}
        >
          <Zap size={12} /> Skill
        </button>
        <button
          onClick={() => setGenTarget('mcp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            genTarget === 'mcp' ? 'bg-apple-green/10 text-apple-green border-apple-green/30' : 'text-[var(--text-secondary)] border-[var(--border-default)] hover:border-apple-green/20'
          }`}
        >
          <Plug size={12} /> MCP Server
        </button>
        <button
          onClick={() => handleGenerate(genTarget)}
          disabled={genLoading || !query.trim()}
          className="ml-auto apple-button text-xs py-1.5 flex items-center gap-1.5 disabled:opacity-40"
        >
          {genLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {genLoading ? t('chat.generate.loading', 'Generating...') : t('search.gen.start', 'Generate from wiki')}
        </button>
      </div>

      {genLoading && genStage && (
        <div className="flex items-center gap-3 py-6 px-2">
          {STAGES.map((stage, i) => {
            const cur = STAGES.indexOf(genStage!);
            const active = stage === genStage;
            const done = i < cur;
            return (
              <div key={stage} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  active ? 'bg-apple-purple text-white animate-pulse' : done ? 'bg-apple-green text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border border-[var(--border-default)]'
                }`}>{done ? '✓' : i + 1}</div>
                <span className={`text-[11px] ${active ? 'text-apple-purple font-medium' : done ? 'text-apple-green' : 'text-[var(--text-tertiary)]'}`}>
                  {t(`chat.generate.stage.${stage}`, stage)}
                </span>
                {i < 2 && <div className={`w-6 h-px ${done ? 'bg-apple-green' : 'bg-[var(--border-default)]'}`} />}
              </div>
            );
          })}
        </div>
      )}

      {!genLoading && !genResult && (
        <div className="text-center py-16 text-[var(--text-tertiary)]">
          <Wand2 size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">{t('search.gen.empty', 'Enter a query above, then click Generate to create a Skill or MCP Server from your wiki knowledge.')}</p>
        </div>
      )}

      {genResult && !genLoading && (
        <div className="space-y-3">
          {genResult.explanation && (
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{genResult.explanation}</p>
          )}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{genTarget === 'mcp' ? 'Python' : 'Markdown'}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsEditingCode(!isEditingCode)} className={`text-[10px] px-2 py-0.5 rounded transition-colors ${isEditingCode ? 'bg-apple-blue/10 text-apple-blue' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}>
                  {isEditingCode ? t('chat.generate.preview', 'Preview') : t('chat.generate.edit', 'Edit')}
                </button>
                <button onClick={() => navigator.clipboard.writeText(isEditingCode ? editedCode : genResult.code)} className="text-[10px] px-2 py-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  {t('chat.copy', 'Copy')}
                </button>
              </div>
            </div>
            {isEditingCode ? (
              <textarea
                value={editedCode}
                onChange={e => setEditedCode(e.target.value)}
                className="w-full text-[11px] font-mono bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg p-3 max-h-64 overflow-y-auto resize-y focus:outline-none focus:border-apple-blue/40"
                rows={Math.min(editedCode.split('\n').length + 2, 20)}
                spellCheck={false}
              />
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-default)]">
                <MarkdownRenderer content={`\`\`\`${genTarget === 'mcp' ? 'python' : 'markdown'}\n${genResult.code}\n\`\`\``} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleInstall} className="apple-button text-xs py-1.5 bg-apple-green/10 text-apple-green border-apple-green/20">
              {t('chat.generate.install', 'Install {{target}}', { target: genTarget.toUpperCase() })}
            </button>
            <button onClick={() => handleGenerate(genTarget)} className="apple-button text-xs py-1.5 flex items-center gap-1">
              <RotateCw size={10} />{t('chat.generate.regenerate', 'Regenerate')}
            </button>
            <button onClick={handleDownload} className="apple-button text-xs py-1.5 flex items-center gap-1">
              <Download size={10} />{t('chat.generate.download', 'Download')}
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRefine(); }}
              placeholder={t('chat.generate.refinePlaceholder', 'Refine: e.g. add error handling...')}
              className="flex-1 text-[11px] bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-apple-blue/40 placeholder:text-[var(--text-tertiary)]"
              disabled={refineLoading}
            />
            <button onClick={handleRefine} disabled={!refineInput.trim() || refineLoading} className="apple-button text-xs py-1.5 disabled:opacity-40">
              {refineLoading ? <Loader2 size={12} className="animate-spin" /> : t('chat.generate.refine', 'Refine')}
            </button>
          </div>

          {genResult.sources.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-[var(--text-tertiary)] mb-1">{t('chat.generate.sources', 'Sources')}:</p>
              <div className="flex flex-wrap gap-1">
                {genResult.sources.map(s => (
                  <Link key={s.path} to={`/${s.path.replace(/\.md$/, '')}`} className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)] hover:text-apple-blue transition-colors">
                    {s.path.split('/').pop()?.replace('.md', '')}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
