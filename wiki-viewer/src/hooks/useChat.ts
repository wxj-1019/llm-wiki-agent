import { useState, useEffect, useCallback, useRef } from 'react';
import { safeGet, safeSet, isArray } from '@/lib/safeStorage';
import { StreamDeduplicator, mergeStreamChunk } from '@/lib/streamUtils';
import {
  chatWithLLMStream,
  readAgentKitFile,
  saveAgentKitFile,
  generateFromKnowledge,
} from '@/services/agentKitLLMService';
import type { ChatMessage as BaseChatMessage, KnowledgeSource } from '@/services/agentKitLLMService';

export interface ChatMessage extends BaseChatMessage {
  knowledgeGen?: boolean;
  code?: string;
}

export function useChat(addToast: (message: string, type: 'success' | 'error') => void, loadStatus: () => Promise<void>, loadFiles: () => Promise<void>) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    return safeGet('agent-kit-chat-history', isArray, []) as ChatMessage[];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewPath, setPreviewPath] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;
  const chatLoadingRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      safeSet('agent-kit-chat-history', chatMessages);
    }, 500);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [chatMessages]);

  const [knowledgeGenTarget, setKnowledgeGenTarget] = useState<'mcp' | 'skill' | null>(null);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [showSources, setShowSources] = useState(false);

  const handleStopChat = useCallback(() => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setChatLoading(false);
    chatLoadingRef.current = false;
  }, []);

  const handleSendChat = useCallback(async (content: string) => {
    if (!content.trim() || chatLoadingRef.current) return;
    const userMsg: ChatMessage = { role: 'user', content };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    chatLoadingRef.current = true;
    const abort = new AbortController();
    chatAbortRef.current = abort;

    if (knowledgeGenTarget) {
      const target = knowledgeGenTarget;
      try {
        const result = await generateFromKnowledge(content, target);
        setKnowledgeSources(result.sources);
        setShowSources(result.sources.length > 0);

        const assistantContent =
          (result.explanation ? result.explanation + '\n\n' : '') +
          (result.code ? '```\n' + result.code + '\n```' : '');

        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: assistantContent,
            knowledgeGen: true,
            code: result.code,
          },
        ]);

        if (result.code && result.code.length > 50) {
          setPreviewContent(result.code);
          const ext = target === 'mcp' ? '.py' : '.md';
          setPreviewPath(`agent-kit/generated-${target}${ext}`);
          setEditorOpen(true);
        }

        addToast(
          result.sources.length > 0
            ? `Generated ${target.toUpperCase()} from ${result.sources.length} knowledge source(s)`
            : `Generated ${target.toUpperCase()} (no wiki sources found)`,
          result.sources.length > 0 ? 'success' : 'error'
        );
      } catch (e) {
        const err = (e as Error).message;
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error generating ${target.toUpperCase()}: ${err}` },
        ]);
        addToast(err, 'error');
      } finally {
        setChatLoading(false);
        chatLoadingRef.current = false;
        setKnowledgeGenTarget(null);
        chatAbortRef.current = null;
      }
      return;
    }

    try {
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      setChatMessages((prev) => [...prev, assistantMsg]);
      const historyForApi = [...chatMessagesRef.current, userMsg];
      const stream = chatWithLLMStream(historyForApi, undefined, abort.signal);
      const deduper = new StreamDeduplicator();
      for await (const part of stream) {
        if (part.error) {
          setChatMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'assistant', content: `Error: ${part.error}` };
            return copy;
          });
          addToast(part.error, 'error');
          return;
        }
        if (part.chunk) {
          const result = deduper.process(part.chunk);
          if (!result) continue;

          setChatMessages((prev) => {
            const copy = [...prev];
            const current = copy[copy.length - 1].content;
            copy[copy.length - 1] = { role: 'assistant', content: mergeStreamChunk(current, result) };
            return copy;
          });
        }
        if (part.done) break;
      }
    } catch (e) {
      const err = (e as Error).message;
      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err}` };
        return copy;
      });
      addToast(err, 'error');
    } finally {
      setChatLoading(false);
      chatLoadingRef.current = false;
      chatAbortRef.current = null;
    }
  }, [knowledgeGenTarget, addToast]);

  const handleQuickPrompt = useCallback(async (type: 'review-skill' | 'review-mcp' | 'suggest-tools' | 'custom') => {
    setChatOpen(true);
    setChatLoading(true);
    chatLoadingRef.current = true;
    let systemPrompt = '';
    let userPrompt = '';
    let filePath = '';

    try {
      if (type === 'review-skill') {
        filePath = 'skills/llm-wiki-knowledge/SKILL.md';
        const file = await readAgentKitFile(filePath);
        systemPrompt = 'You are an expert in designing LLM skills (Kimi Skills). Review the provided SKILL.md and suggest concrete improvements: structure, clarity, coverage, and workflow guidance.';
        userPrompt = `Please review the following SKILL.md and suggest improvements:\n\n---\n${file.content}\n---`;
      } else if (type === 'review-mcp') {
        filePath = 'mcp-server/wiki_mcp_server.py';
        const file = await readAgentKitFile(filePath);
        systemPrompt = 'You are an expert Python developer specializing in MCP (Model Context Protocol) servers. Review the provided code and suggest improvements, bug fixes, or missing tools/resources.';
        userPrompt = `Please review the following MCP server code and suggest improvements:\n\n---\n${file.content}\n---`;
      } else if (type === 'suggest-tools') {
        systemPrompt = 'You are an expert in MCP server design. Based on the wiki knowledge base context, suggest new tools or resources that should be added to the MCP server. Consider: search, graph traversal, entity comparison, timeline analysis, etc.';
        userPrompt = 'Based on the current wiki knowledge base, suggest 3-5 new MCP tools or resources that would enhance the agent kit. For each, provide: name, description, and Python implementation sketch.';
      } else {
        systemPrompt = 'You are an AI assistant helping with the LLM Wiki Agent Kit. You can review code, suggest improvements, generate skill content, or answer questions about MCP and skill design.';
        userPrompt = 'How can I improve my Agent Kit?';
      }

      const displayPrompt = userPrompt.slice(0, 200) + (userPrompt.length > 200 ? '...' : '');
      setChatMessages((prev) => [
        ...prev,
        { role: 'user', content: displayPrompt },
        { role: 'assistant', content: '' },
      ]);

      const abort = new AbortController();
      chatAbortRef.current = abort;
      const messages: ChatMessage[] = [{ role: 'user', content: userPrompt }];
      const stream = chatWithLLMStream(messages, systemPrompt, abort.signal);
      const deduper = new StreamDeduplicator();
      let fullReply = '';
      for await (const part of stream) {
        if (part.error) {
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: `Error: ${part.error}` };
            return next;
          });
          addToast(part.error, 'error');
          return;
        }
        if (part.chunk) {
          const result = deduper.process(part.chunk);
          if (!result) continue;
          fullReply += result.text;
          setChatMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: fullReply };
            return next;
          });
        }
        if (part.done) break;
      }
      if (fullReply.includes('```') || fullReply.includes('def ') || fullReply.includes('---')) {
        setPreviewContent(fullReply);
        setPreviewPath(filePath || 'agent-kit/suggestion.md');
        setEditorOpen(true);
      }
    } catch (e) {
      const err = (e as Error).message;
      setChatMessages((prev) => {
        const next = [...prev];
        if (next.length >= 1) {
          next[next.length - 1] = { role: 'assistant', content: `Error: ${err}` };
        } else {
          next.push({ role: 'assistant', content: `Error: ${err}` });
        }
        return next;
      });
      addToast(err, 'error');
    } finally {
      setChatLoading(false);
      chatLoadingRef.current = false;
      chatAbortRef.current = null;
    }
  }, [addToast]);

  const handleSavePreview = useCallback(async () => {
    if (!previewPath || !previewContent) return;
    try {
      await saveAgentKitFile(previewPath, previewContent);
      addToast('Saved successfully', 'success');
      setEditorOpen(false);
      await loadStatus();
      await loadFiles();
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  }, [previewPath, previewContent, addToast, loadStatus, loadFiles]);

  const handleOpenInEditor = useCallback(async (path: string) => {
    try {
      const file = await readAgentKitFile(path);
      setPreviewContent(file.content);
      setPreviewPath(path);
      setEditorOpen(true);
      setChatOpen(true);
    } catch (e) {
      addToast((e as Error).message, 'error');
    }
  }, [addToast]);

  const startKnowledgeGen = useCallback((target: 'mcp' | 'skill') => {
    setChatOpen(true);
    setKnowledgeGenTarget(target);
    const guide = target === 'mcp'
      ? '🧠 **Knowledge-based MCP Generation**\n\nDescribe the MCP Server you want to build. I will search the wiki knowledge base for relevant information and generate a complete MCP Server implementation for you.'
      : '📦 **Knowledge-based Skill Generation**\n\nDescribe the Skill you want to build. I will search the wiki knowledge base for relevant information and generate a complete Skill (SKILL.md) for you.';
    setChatMessages([{ role: 'assistant', content: guide }]);
    setPreviewContent('');
    setEditorOpen(false);
    setKnowledgeSources([]);
    setShowSources(false);
  }, []);

  const resetChat = useCallback(() => {
    setChatOpen(true);
    setChatMessages([]);
    setPreviewContent('');
    setEditorOpen(false);
    setKnowledgeGenTarget(null);
    setKnowledgeSources([]);
    setShowSources(false);
  }, []);

  return {
    chatOpen,
    setChatOpen,
    chatMessages,
    setChatMessages,
    chatInput,
    setChatInput,
    chatLoading,
    previewContent,
    setPreviewContent,
    previewPath,
    setPreviewPath,
    editorOpen,
    setEditorOpen,
    knowledgeGenTarget,
    setKnowledgeGenTarget,
    knowledgeSources,
    showSources,
    setShowSources,
    handleSendChat,
    handleStopChat,
    handleQuickPrompt,
    handleSavePreview,
    handleOpenInEditor,
    startKnowledgeGen,
    resetChat,
  };
}
