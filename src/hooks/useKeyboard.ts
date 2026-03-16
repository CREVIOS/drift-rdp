import { useEffect } from 'react';
import { useSessionStore } from '../stores/sessionStore';

interface KeyboardShortcuts {
  onNewConnection?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboard({ onNewConnection, onShowShortcuts }: KeyboardShortcuts = {}) {
  const toggleQuickConnect = useSessionStore((s) => s.toggleQuickConnect);
  const togglePerformanceHud = useSessionStore((s) => s.togglePerformanceHud);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K = Quick Connect
      if (isMod && e.key === 'k') {
        e.preventDefault();
        toggleQuickConnect();
        return;
      }

      // Cmd/Ctrl + N = New Connection
      if (isMod && e.key === 'n') {
        e.preventDefault();
        onNewConnection?.();
        return;
      }

      // Ctrl + Shift + P = Performance HUD
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        togglePerformanceHud();
        return;
      }

      // Cmd/Ctrl + ? (Cmd+Shift+/) = Shortcut help
      if (isMod && e.shiftKey && e.key === '?') {
        e.preventDefault();
        onShowShortcuts?.();
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleQuickConnect, togglePerformanceHud, onNewConnection, onShowShortcuts]);
}
