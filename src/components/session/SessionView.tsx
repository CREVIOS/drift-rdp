import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useRdpSession } from '../../hooks/useRdpSession';
import { useConnectionStore } from '../../stores/connectionStore';
import { SessionCanvas } from './SessionCanvas';
import { SessionToolbar } from './SessionToolbar';
import { SessionTabs } from './SessionTabs';
import { PerformanceHUD } from './PerformanceHUD';
import * as tauri from '../../lib/tauri';

export function SessionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const connections = useConnectionStore((s) => s.connections);

  const {
    sessionId,
    status,
    frame,
    fps,
    latency,
    bandwidth,
    reconnectAttempts,
    maxReconnectAttempts,
    connect,
    disconnect,
    cancelReconnect,
    sendKey,
    sendMouse,
  } = useRdpSession();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const connectingRef = useRef(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Connect on mount - id is always a connectionId
  useEffect(() => {
    if (id && !sessionId && !connectingRef.current) {
      connectingRef.current = true;
      connect(id).finally(() => {
        connectingRef.current = false;
      });
    }
  }, [id, sessionId, connect]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const handleCtrlAltDel = useCallback(() => {
    if (!sessionId) return;
    // Send Ctrl+Alt+Del key sequence
    const keys = [
      { keyCode: 0x11, isDown: true },  // Ctrl down
      { keyCode: 0x12, isDown: true },  // Alt down
      { keyCode: 0x2e, isDown: true },  // Del down
      { keyCode: 0x2e, isDown: false }, // Del up
      { keyCode: 0x12, isDown: false }, // Alt up
      { keyCode: 0x11, isDown: false }, // Ctrl up
    ];
    for (const key of keys) {
      tauri.sendKeyEvent(sessionId, key).catch(() => {});
    }
  }, [sessionId]);

  const handleScreenshot = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `rdp-screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    navigate('/');
  }, [disconnect, navigate]);

  const handleCancelReconnect = useCallback(async () => {
    await cancelReconnect();
    await disconnect();
    navigate('/');
  }, [cancelReconnect, disconnect, navigate]);

  const handleResize = useCallback(
    (width: number, height: number) => {
      if (!sessionId) return;
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
      }
      resizeTimerRef.current = setTimeout(() => {
        tauri.resizeSession(sessionId, width, height).catch(() => {});
        resizeTimerRef.current = null;
      }, 200);
    },
    [sessionId]
  );

  // Escape key to show disconnect confirm
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && status === 'connected') {
        setShowDisconnectConfirm(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status]);

  const connectionInfo = connections.find(
    (c) => c.id === id || (sessionId && c.id === id)
  );
  const hostname = connectionInfo?.host ?? 'Unknown';
  const resolution = connectionInfo
    ? `${connectionInfo.displayWidth ?? 1920}x${connectionInfo.displayHeight ?? 1080}`
    : '1920x1080';

  return (
    <div className="flex flex-col h-full relative">
      <SessionTabs />

      <div className="relative flex-1 overflow-hidden">
        {/* Toolbar */}
        <SessionToolbar
          hostname={hostname}
          resolution={resolution}
          fps={fps}
          latency={latency}
          onFullscreen={handleFullscreen}
          onCtrlAltDel={handleCtrlAltDel}
          onScreenshot={handleScreenshot}
          onDisconnect={() => setShowDisconnectConfirm(true)}
          isFullscreen={isFullscreen}
        />

        {/* Canvas */}
        <SessionCanvas
          frame={frame}
          status={status}
          reconnectAttempts={reconnectAttempts}
          maxReconnectAttempts={maxReconnectAttempts}
          onKeyDown={sendKey}
          onKeyUp={sendKey}
          onMouseMove={(e, rect) => sendMouse(e, 'move', rect)}
          onMouseDown={(e, rect) => sendMouse(e, 'down', rect)}
          onMouseUp={(e, rect) => sendMouse(e, 'up', rect)}
          onResize={handleResize}
        />

        {/* Performance HUD */}
        <PerformanceHUD
          fps={fps}
          latency={latency}
          bandwidth={bandwidth}
          resolution={resolution}
        />
      </div>

      {/* Cancel Reconnect button */}
      {status === 'reconnecting' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={handleCancelReconnect}
            className="px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/80 transition-colors shadow-lg"
          >
            Cancel Reconnect
          </button>
        </div>
      )}

      {/* Disconnect confirmation */}
      <AnimatePresence>
        {showDisconnectConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDisconnectConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-2xl p-6 text-center"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--color-warning)]/10 mx-auto mb-4">
                <AlertTriangle size={24} className="text-[var(--color-warning)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                Disconnect Session?
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-5">
                This will close your connection to {hostname}. Any unsaved work on the remote machine will remain open.
              </p>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/80 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
