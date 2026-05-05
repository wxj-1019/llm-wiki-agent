import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { Users, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface CollabEditorProps {
  docId: string;
  initialContent: string;
  onChange: (content: string) => void;
  wrapperClassName?: string;
  textareaClassName?: string;
}

type ConnStatus = 'connecting' | 'connected' | 'disconnected' | 'syncing';

export function CollabEditor({
  docId,
  initialContent,
  onChange,
  wrapperClassName = '',
  textareaClassName = 'w-full h-[60vh]',
}: CollabEditorProps) {
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [userCount, setUserCount] = useState(1);
  const [localContent, setLocalContent] = useState(initialContent);
  const wsRef = useRef<WebSocket | null>(null);
  const doc = useMemo(() => new Y.Doc(), []);
  const ytext = useMemo(() => doc.getText('content'), [doc]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRemoteUpdate = useRef(false);

  // Initialize Y.Text with initial content
  useEffect(() => {
    if (ytext.length === 0 && initialContent) {
      ytext.insert(0, initialContent);
    }
  }, [ytext, initialContent]);

  // Observe Y.Text changes -> local state & parent onChange
  useEffect(() => {
    const observer = () => {
      const text = ytext.toString();
      setLocalContent(text);
      onChange(text);
    };
    ytext.observe(observer);
    return () => ytext.unobserve(observer);
  }, [ytext, onChange]);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/collab/${docId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
    };

    ws.onclose = () => {
      setStatus('disconnected');
    };

    ws.onerror = () => {
      setStatus('disconnected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'presence') {
          setUserCount(msg.count || 1);
        } else if (msg.type === 'update') {
          // Apply remote update to Yjs doc
          isRemoteUpdate.current = true;
          doc.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, msg.content || '');
          });
          isRemoteUpdate.current = false;
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [docId, doc, ytext]);

  const sendUpdate = useCallback(
    (content: string) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        setStatus('syncing');
        ws.send(JSON.stringify({ type: 'update', content, cursor: 0 }));
        setTimeout(() => setStatus((s) => (s === 'syncing' ? 'connected' : s)), 300);
      }
    },
    []
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;

    // Update Yjs document (skip if this change came from remote)
    if (!isRemoteUpdate.current) {
      doc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newText);
      });
    }

    // Debounce broadcast
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      sendUpdate(newText);
    }, 300);
  };

  const statusConfig: Record<
    ConnStatus,
    { icon: React.ReactNode; label: string; color: string }
  > = {
    connecting: {
      icon: <Loader2 size={14} className="animate-spin" />,
      label: 'Connecting...',
      color: 'text-amber-500',
    },
    connected: {
      icon: <Wifi size={14} />,
      label: 'Connected',
      color: 'text-emerald-500',
    },
    disconnected: {
      icon: <WifiOff size={14} />,
      label: 'Disconnected',
      color: 'text-red-500',
    },
    syncing: {
      icon: <Loader2 size={14} className="animate-spin" />,
      label: 'Syncing...',
      color: 'text-apple-blue',
    },
  };

  const current = statusConfig[status];

  return (
    <div className={`flex flex-col gap-2 ${wrapperClassName}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`flex items-center gap-1 text-xs font-medium ${current.color}`}
            title={current.label}
          >
            {current.icon}
            {current.label}
          </span>
          <span className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
            <Users size={14} />
            {userCount} {userCount === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>
      <textarea
        value={localContent}
        onChange={handleChange}
        className={`p-4 font-mono text-sm bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-apple-blue/30 ${textareaClassName}`}
        spellCheck={false}
      />
    </div>
  );
}
