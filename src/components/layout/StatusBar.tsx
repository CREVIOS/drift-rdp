import { Sun, Moon, MonitorCog } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useTheme } from '../../hooks/useTheme';

export function StatusBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { theme, toggle } = useTheme();

  const activeSession = activeSessionId ? sessions.get(activeSessionId) : null;
  const sessionCount = sessions.size;

  const statusText = activeSession
    ? `Connected to ${activeSession.connectionId} - ${activeSession.width}x${activeSession.height}`
    : 'No active connection';

  return (
    <div
      className="flex items-center justify-between px-3 shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-1)] text-[10px] select-none"
      style={{ height: 28 }}
    >
      {/* Left: connection status */}
      <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
        {activeSession && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-success)] pulse-online" />
        )}
        <span>{statusText}</span>
      </div>

      {/* Center: session count */}
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        <MonitorCog size={11} />
        <span>
          {sessionCount} active session{sessionCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Right: theme toggle */}
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        title={`Theme: ${theme}`}
      >
        {theme === 'dark' ? <Moon size={11} /> : theme === 'light' ? <Sun size={11} /> : <MonitorCog size={11} />}
        <span className="capitalize">{theme}</span>
      </button>
    </div>
  );
}
