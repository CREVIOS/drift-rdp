import { useState, useEffect, useRef, useCallback } from 'react';
import { Channel } from '@tauri-apps/api/core';
import type { SessionStatus } from '../types';
import { useSessionStore } from '../stores/sessionStore';
import * as tauri from '../lib/tauri';
import { mapKeyEvent, mapMouseEvent } from '../lib/input-mapper';

interface UseRdpSessionReturn {
  sessionId: string | null;
  status: SessionStatus;
  frame: string | null;
  fps: number;
  latency: number;
  bandwidth: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  connect: (connectionId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  cancelReconnect: () => Promise<void>;
  sendKey: (e: globalThis.KeyboardEvent) => void;
  sendMouse: (e: globalThis.MouseEvent, type: 'move' | 'down' | 'up' | 'scroll', rect?: DOMRect) => void;
}

export function useRdpSession(): UseRdpSessionReturn {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [frame, setFrame] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const [bandwidth, setBandwidth] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [maxReconnectAttempts, setMaxReconnectAttempts] = useState(5);

  const infoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameChannelRef = useRef<Channel<string> | null>(null);

  const addSession = useSessionStore((s) => s.addSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const updateSession = useSessionStore((s) => s.updateSession);

  const stopPolling = useCallback(() => {
    frameChannelRef.current = null;
    if (infoIntervalRef.current) {
      clearInterval(infoIntervalRef.current);
      infoIntervalRef.current = null;
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
        setFrame(null);
        setFps(0);
        frameCountRef.current = 0;

        const frameChannel = new Channel<string>((payload) => {
          setFrame(payload);
          frameCountRef.current++;
        });
        frameChannelRef.current = frameChannel;

        const sid = await tauri.connect(connectionId, frameChannel);
        setSessionId(sid);

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

        const syncSessionInfo = async () => {
          const info = await tauri.getSessionInfo(sid);
          if (!info) return;

          setLatency(info.latency);
          setBandwidth(info.bandwidth);
          setReconnectAttempts(info.reconnectAttempts);
          setMaxReconnectAttempts(info.maxReconnectAttempts);
          updateSession(sid, info);

          const backendStatus = info.status;
          if (typeof backendStatus === 'string') {
            setStatus(backendStatus as SessionStatus);
          } else if (typeof backendStatus === 'object' && backendStatus !== null) {
            setStatus('error');
          }
        };

        await syncSessionInfo();

        // Poll session info every second
        infoIntervalRef.current = setInterval(() => {
          void syncSessionInfo();
        }, 1000);

        // Calculate FPS every second
        fpsIntervalRef.current = setInterval(() => {
          setFps(frameCountRef.current);
          frameCountRef.current = 0;
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
    setFrame(null);
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
      tauri.sendKeyEvent(sessionId, mapped).catch(() => {});
    },
    [sessionId]
  );

  const sendMouse = useCallback(
    (e: globalThis.MouseEvent, type: 'move' | 'down' | 'up' | 'scroll', rect?: DOMRect) => {
      if (!sessionId) return;
      const mapped = mapMouseEvent(e, type, rect);
      tauri.sendMouseEvent(sessionId, mapped).catch(() => {});
    },
    [sessionId]
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
    frame,
    fps,
    latency,
    bandwidth,
    reconnectAttempts,
    maxReconnectAttempts,
    connect: connectFn,
    disconnect: disconnectFn,
    cancelReconnect: cancelReconnectFn,
    sendKey,
    sendMouse,
  };
}
