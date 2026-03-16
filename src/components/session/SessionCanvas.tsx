import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, WifiOff } from 'lucide-react';
import type { SessionStatus } from '../../types';

interface Props {
  frame: string | null;
  status: SessionStatus;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  onKeyDown: (e: globalThis.KeyboardEvent) => void;
  onKeyUp: (e: globalThis.KeyboardEvent) => void;
  onMouseMove: (e: globalThis.MouseEvent, rect: DOMRect) => void;
  onMouseDown: (e: globalThis.MouseEvent, rect: DOMRect) => void;
  onMouseUp: (e: globalThis.MouseEvent, rect: DOMRect) => void;
  onResize?: (width: number, height: number) => void;
}

export function SessionCanvas({
  frame,
  status,
  reconnectAttempts = 0,
  maxReconnectAttempts = 5,
  onKeyDown,
  onKeyUp,
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onResize,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const pendingFrameRef = useRef<string | null>(null);
  const decodeInFlightRef = useRef(false);

  const drainFrameQueue = useCallback(() => {
    if (decodeInFlightRef.current || !pendingFrameRef.current || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!imgRef.current) {
      imgRef.current = new Image();
      imgRef.current.decoding = 'async';
    }

    const frameToDraw = pendingFrameRef.current;
    pendingFrameRef.current = null;
    decodeInFlightRef.current = true;

    const img = imgRef.current;
    img.onload = () => {
      requestAnimationFrame(() => {
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        ctx.drawImage(img, 0, 0);
        decodeInFlightRef.current = false;
        drainFrameQueue();
      });
    };
    img.onerror = () => {
      decodeInFlightRef.current = false;
      drainFrameQueue();
    };
    img.src = `data:image/jpeg;base64,${frameToDraw}`;
  }, []);

  // Decode frames serially and only keep the latest one to avoid render backlog.
  useEffect(() => {
    if (!frame) return;
    pendingFrameRef.current = frame;
    drainFrameQueue();
  }, [frame, drainFrameQueue]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        onResize?.(Math.round(width), Math.round(height));
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [onResize]);

  // Keyboard events
  useEffect(() => {
    const handleDown = (e: globalThis.KeyboardEvent) => {
      e.preventDefault();
      onKeyDown(e);
    };
    const handleUp = (e: globalThis.KeyboardEvent) => {
      e.preventDefault();
      onKeyUp(e);
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('keydown', handleDown);
    canvas.addEventListener('keyup', handleUp);
    return () => {
      canvas.removeEventListener('keydown', handleDown);
      canvas.removeEventListener('keyup', handleUp);
    };
  }, [onKeyDown, onKeyUp]);

  const getRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = getRect();
      if (rect) onMouseMove(e.nativeEvent, rect);
    },
    [onMouseMove, getRect]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = getRect();
      if (rect) onMouseDown(e.nativeEvent, rect);
      canvasRef.current?.focus();
    },
    [onMouseDown, getRect]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const rect = getRect();
      if (rect) onMouseUp(e.nativeEvent, rect);
    },
    [onMouseUp, getRect]
  );

  // Loading state
  if (status === 'connecting') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-surface-0)]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 size={36} className="text-[var(--color-accent)]" />
        </motion.div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-4">
          Establishing connection...
        </p>
      </div>
    );
  }

  // Error / disconnected state
  if (status === 'error' || status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[var(--color-surface-0)]">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] mb-4">
          <WifiOff size={28} className="text-[var(--color-danger)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
          {status === 'error' ? 'Connection Error' : 'Disconnected'}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {status === 'error'
            ? 'Failed to connect to the remote desktop'
            : 'The session has been disconnected'}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="w-full h-full object-contain outline-none cursor-default"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      {/* Reconnecting overlay */}
      {status === 'reconnecting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block"
            >
              <Loader2 size={28} className="text-[var(--color-warning)]" />
            </motion.div>
            <p className="text-sm text-white mt-3">
              Reconnecting...{reconnectAttempts > 0 && ` (attempt ${reconnectAttempts}/${maxReconnectAttempts})`}
            </p>
            {reconnectAttempts > 0 && (
              <p className="text-xs text-white/60 mt-1">
                Retrying in {Math.min(1 << reconnectAttempts, 30)}s...
              </p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
