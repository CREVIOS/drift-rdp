import { useState, useEffect, useRef, useCallback } from 'react';
import { Channel } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SessionStatus } from '../types';
import type { SessionInfo } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import * as tauri from '../lib/tauri';
import type { FramePayload } from '../lib/frame-protocol';
import { toFrameBytes } from '../lib/frame-protocol';
import {
  mapKeyEvent,
  mapMouseEvent,
  type MouseSurfaceBounds,
} from '../lib/input-mapper';

type FrameListener = (frame: Uint8Array) => void;

interface UseRdpSessionReturn {
  sessionId: string | null;
  status: SessionStatus;
  fps: number;
  latency: number;
  bandwidth: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  subscribeToFrames: (listener: FrameListener) => () => void;
  reportFramePresented: () => void;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  cancelReconnect: () => Promise<void>;
  sendKey: (e: globalThis.KeyboardEvent) => void;
  sendWheel: (
    e: globalThis.WheelEvent,
    bounds?: MouseSurfaceBounds
  ) => void;
  sendMouse: (
    e: globalThis.MouseEvent,
    type: 'move' | 'down' | 'up' | 'scroll',
    bounds?: MouseSurfaceBounds
  ) => void;
}

export function useRdpSession(): UseRdpSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [bandwidth, setBandwidth] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(5);

  const frameCountRef = useRef(0);
  const byteCountRef = useRef(0);
  const latestFpsRef = useRef(0);
  const latestBandwidthRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameChannelRef = useRef<Channel<FramePayload> | null>(null);
  const frameListenersRef = useRef<Set<FrameListener>>(new Set());
  const sessionInfoUnlistenRef = useRef<(() => void) | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pendingMouseMoveRef = useRef<ReturnType<typeof mapMouseEvent> | null>(null);
  const mouseMoveScheduledRef = useRef(false);

  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  const subscribeToFrames = useCallback((listener: FrameListener) => {
    frameListenersRef.current.add(listener);
    return () => {
      frameListenersRef.current.delete(listener);
    };
  }, []);

  const reportFramePresented = useCallback(() => {
    frameCountRef.current++;
  }, []);

  const stopPolling = useCallback(() => {
    frameChannelRef.current = null;
    sessionIdRef.current = null;
    pendingMouseMoveRef.current = null;
    mouseMoveScheduledRef.current = false;
    if (sessionInfoUnlistenRef.current) {
      sessionInfoUnlistenRef.current();
      sessionInfoUnlistenRef.current = null;
    }
    if (fpsIntervalRef.current) {
      clearInterval(fpsIntervalRef.current);
      fpsIntervalRef.current = null;
    }
  }, []);

  const connectFn = useCallback(
    async (connectionId: string) => {
      try {
        stopPolling();
        setStatus('connecting');
        setFps(0);
        setBandwidth(0);
        frameCountRef.current = 0;
        byteCountRef.current = 0;
        latestFpsRef.current = 0;
        latestBandwidthRef.current = 0;

        const frameChannel = new Channel<FramePayload>((payload) => {
          const bytes = toFrameBytes(payload);
          byteCountRef.current += bytes.byteLength;
          frameListenersRef.current.forEach((listener) => listener(bytes));
        });
        frameChannelRef.current = frameChannel;

        const sid = await tauri.connect(connectionId, frameChannel);
        setSessionId(sid);
        sessionIdRef.current = sid;

        addSession({
          id: sid,
          connectionId,
          connectionName: '',
          host: '',
          status: 'connecting',
          fps: 0,
          latency: 0,
          bandwidth: 0,
          width: 0,
          height: 0,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          lastError: null,
        });

        const applySessionInfo = (info: SessionInfo) => {
          const backendStatus = info.status;
          const nextStatus =
            typeof backendStatus === 'string'
              ? (backendStatus as SessionStatus)
              : 'error';

          setLatency(info.latency);
          setReconnectAttempts(info.reconnectAttempts);
          setMaxReconnectAttempts(info.maxReconnectAttempts);
          setStatus(nextStatus);
          updateSession(sid, {
            ...info,
            status: nextStatus,
            fps: latestFpsRef.current,
            bandwidth: latestBandwidthRef.current,
          });
        };

        const syncSessionInfo = async () => {
          const info = await tauri.getSessionInfo(sid);
          if (!info) return;
          applySessionInfo(info);
        };

        await syncSessionInfo();
        sessionInfoUnlistenRef.current = await listen<SessionInfo>(
          `session-info-${sid}`,
          (event) => {
            applySessionInfo(event.payload);
          }
        );

        // Calculate FPS every second
        fpsIntervalRef.current = setInterval(() => {
          const nextFps = frameCountRef.current;
          const nextBandwidth = byteCountRef.current;

          latestFpsRef.current = nextFps;
          latestBandwidthRef.current = nextBandwidth;

          setFps(nextFps);
          setBandwidth(nextBandwidth);
          updateSession(sid, {
            fps: nextFps,
            bandwidth: nextBandwidth,
          });

          frameCountRef.current = 0;
          byteCountRef.current = 0;
        }, 1000);
      } catch (e) {
        console.error('Connection failed:', e);
        setStatus('error');
      }
    },
    [addSession, stopPolling, updateSession]
  );

  const disconnectFn = useCallback(async () => {
    stopPolling();
    if (sessionId) {
      try {
        await tauri.disconnect(sessionId);
      } catch (e) {
        console.error('Disconnect error:', e);
      }
      removeSession(sessionId);
    }
    setSessionId(null);
    setStatus('disconnected');
    setFps(0);
    setLatency(0);
    setBandwidth(0);
    setReconnectAttempts(0);
  }, [sessionId, stopPolling, removeSession]);

  const cancelReconnectFn = useCallback(async () => {
    if (sessionId) {
      try {
        await tauri.cancelReconnect(sessionId);
      } catch (e) {
        console.error('Cancel reconnect error:', e);
      }
    }
  }, [sessionId]);

  const sendKey = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (!sessionId) return;
      const mapped = mapKeyEvent(e);
      if (mapped.keyCode === 0) return;
      tauri.sendKeyEvent(sessionId, mapped).catch(() => {});
    },
    [sessionId]
  );

  const sendMouse = useCallback(
    (
      e: globalThis.MouseEvent,
      type: 'move' | 'down' | 'up' | 'scroll',
      bounds?: MouseSurfaceBounds
    ) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;
      const mapped = mapMouseEvent(e, type, bounds);
      if (type === 'move') {
        pendingMouseMoveRef.current = mapped;
        if (mouseMoveScheduledRef.current) {
          return;
        }

        mouseMoveScheduledRef.current = true;
        requestAnimationFrame(() => {
          mouseMoveScheduledRef.current = false;
          const sid = sessionIdRef.current;
          const nextMove = pendingMouseMoveRef.current;
          pendingMouseMoveRef.current = null;

          if (!sid || !nextMove) {
            return;
          }

          tauri.sendMouseEvent(sid, nextMove).catch(() => {});
        });
        return;
      }

      tauri.sendMouseEvent(currentSessionId, mapped).catch(() => {});
    },
    []
  );

  const sendWheel = useCallback(
    (e: globalThis.WheelEvent, bounds?: MouseSurfaceBounds) => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId) return;

      // Map wheel position using same coordinate mapping as mouse
      const mapped = mapMouseEvent(e as unknown as globalThis.MouseEvent, 'scroll', bounds);

      // Convert deltaY from pixels to RDP wheel rotation units
      // Browser deltaY: positive = scroll down, negative = scroll up
      // RDP: positive = scroll up, so we negate
      // Normalize: trackpad gives small deltas (1-10px), mouse gives 100+ (line mode)
      let delta = -e.deltaY;
      if (e.deltaMode === 1) {
        // Line mode (mouse wheel) — each line = 3 rotation units
        delta *= 3;
      } else {
        // Pixel mode (trackpad) — normalize: ~40px = 1 rotation unit
        delta = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 40));
      }

      // Clamp to RDP max (255 rotation units)
      delta = Math.max(-255, Math.min(255, delta));

      mapped.scrollDelta = delta;
      mapped.eventType = 'scroll';

      tauri.sendMouseEvent(currentSessionId, mapped).catch(() => {});
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    sessionId,
    status,
    fps,
    latency,
    bandwidth,
    reconnectAttempts,
    maxReconnectAttempts,
    subscribeToFrames,
    reportFramePresented,
    connect: connectFn,
    disconnect: disconnectFn,
    cancelReconnect: cancelReconnectFn,
    sendKey,
    sendWheel,
    sendMouse,
  };
}
