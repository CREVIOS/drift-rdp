import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Monitor } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import * as tauri from '../../lib/tauri';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
              className={cn(
                'relative flex items-center gap-2 px-4 h-full text-xs font-medium whitespace-nowrap border-r border-[var(--color-border)] transition-colors',
                isActive
                  ? 'bg-[var(--color-surface-0)] text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-accent)]"
                />
              )}
              <Monitor size={12} />
              <span>{getConnectionName(session.connectionId)}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="h-4 w-4 p-0 rounded hover:bg-[var(--color-surface-3)]"
                onClick={(e) => handleClose(e, session.id)}
              >
                <X size={10} />
              </Button>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* New tab button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="shrink-0 rounded-none h-full text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        onClick={() => navigate('/')}
      >
        <Plus size={14} />
      </Button>
    </div>
  );
}
