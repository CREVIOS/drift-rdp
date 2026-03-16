import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Monitor } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import * as tauri from '../../lib/tauri';

export function SessionTabs() {
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActive = useSessionStore((s) => s.setActive);
  const removeSession = useSessionStore((s) => s.removeSession);
  const connections = useConnectionStore((s) => s.connections);

  const sessionList = Array.from(sessions.values());

  if (sessionList.length === 0) return null;

  const getConnectionName = (connectionId: string) => {
    const conn = connections.find((c) => c.id === connectionId);
    return conn?.name ?? 'Unknown';
  };

  const handleTabClick = (sessionId: string) => {
    setActive(sessionId);
    navigate(`/session/${sessionId}`);
  };

  const handleClose = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await tauri.disconnect(sessionId);
    } catch {
      // ignore
    }
    removeSession(sessionId);
    if (sessions.size <= 1) {
      navigate('/');
    }
  };

  return (
    <div className="flex items-center h-9 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] overflow-x-auto shrink-0">
      <AnimatePresence mode="popLayout">
        {sessionList.map((session) => {
          const isActive = session.id === activeSessionId;
          return (
            <motion.button
              key={session.id}
              layout
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => handleTabClick(session.id)}
              className={`relative flex items-center gap-2 px-4 h-full text-xs font-medium whitespace-nowrap border-r border-[var(--color-border)] transition-colors ${
                isActive
                  ? 'bg-[var(--color-surface-0)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-accent)]"
                />
              )}
              <Monitor size={12} />
              <span>{getConnectionName(session.connectionId)}</span>
              <button
                onClick={(e) => handleClose(e, session.id)}
                className="p-0.5 rounded hover:bg-[var(--color-surface-3)] transition-colors"
              >
                <X size={10} />
              </button>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* New tab button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center justify-center w-9 h-full text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
