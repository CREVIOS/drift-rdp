import { useState, useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import * as tauri from '../lib/tauri';

interface UseClipboardOptions {
  sessionId: string | null;
}

export function useClipboard({ sessionId }: UseClipboardOptions) {
  const [syncEnabled, setSyncEnabled] = useState(false);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const toggleSync = useCallback(() => {
    setSyncEnabled((prev) => !prev);
  }, []);

  // Listen for local paste events and send to remote
  useEffect(() => {
    if (!syncEnabled || !sessionId) return;

    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text && sessionIdRef.current) {
        tauri.clipboardWrite(sessionIdRef.current, text).catch((err) => {
          console.error('Failed to sync clipboard to remote:', err);
        });
      }
    };

    document.addEventListener('paste', handlePaste as EventListener);
    return () => {
      document.removeEventListener('paste', handlePaste as EventListener);
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
