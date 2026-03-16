import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import * as tauri from '../lib/tauri';

interface UseClipboardOptions {
  sessionId: string | null;
}

export function useClipboard({ sessionId }: UseClipboardOptions) {
  const [syncEnabled, setSyncEnabled] = useState(true);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const toggleSync = useCallback(() => {
    setSyncEnabled((prev) => !prev);
  }, []);

  // Mirror local clipboard into the remote session when the user pastes.
  useEffect(() => {
    if (!syncEnabled || !sessionId) return;

    const syncClipboardText = (text: string | null | undefined) => {
      if (text && sessionIdRef.current) {
        tauri.clipboardWrite(sessionIdRef.current, text).catch((err) => {
          console.error('Failed to sync clipboard to remote:', err);
        });
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      syncClipboardText(e.clipboardData?.getData('text/plain'));
    };

    const handlePasteShortcut = (e: KeyboardEvent) => {
      const isPasteShortcut =
        (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'v';
      if (!isPasteShortcut || !sessionIdRef.current) {
        return;
      }

      navigator.clipboard
        .readText()
        .then((text) => syncClipboardText(text))
        .catch(() => {});
    };

    document.addEventListener('paste', handlePaste as EventListener);
    window.addEventListener('keydown', handlePasteShortcut);
    return () => {
      document.removeEventListener('paste', handlePaste as EventListener);
      window.removeEventListener('keydown', handlePasteShortcut);
    };
  }, [syncEnabled, sessionId]);

  // Listen for remote clipboard events from the backend
  useEffect(() => {
    if (!syncEnabled || !sessionId) return;

    const eventName = `clipboard-${sessionId}`;
    const unlisten = listen<string>(eventName, (event) => {
      navigator.clipboard.writeText(event.payload).catch((err) => {
        console.error('Failed to write remote clipboard to local:', err);
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [syncEnabled, sessionId]);

  return { syncEnabled, toggleSync };
}
