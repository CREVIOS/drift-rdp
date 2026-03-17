import { invoke } from '@tauri-apps/api/core';
import type { Channel } from '@tauri-apps/api/core';
import type {
  ConnectionConfig,
  SessionInfo,
  AppSettings,
  KeyEvent,
  MouseEvent as RdpMouseEvent,
} from '../types';
import type { FramePayload } from './frame-protocol';

// ── Connection Management ───────────────────────────────────────────

export async function listConnections(): Promise<ConnectionConfig[]> {
  try {
    return await invoke<ConnectionConfig[]>('list_connections');
  } catch (e) {
    console.error('Failed to list connections:', e);
    return [];
  }
}

export async function getConnection(id: string): Promise<ConnectionConfig | null> {
  try {
    return await invoke<ConnectionConfig>('get_connection', { id });
  } catch (e) {
    console.error('Failed to get connection:', e);
    return null;
  }
}

export async function createConnection(
  config: Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ConnectionConfig> {
  return await invoke<ConnectionConfig>('create_connection', { config });
}

export async function updateConnection(
  id: string,
  config: Partial<ConnectionConfig>
): Promise<ConnectionConfig> {
  return await invoke<ConnectionConfig>('update_connection', { id, config });
}

export async function deleteConnection(id: string): Promise<void> {
  await invoke('delete_connection', { id });
}

export async function testConnection(host: string, port: number = 3389): Promise<boolean> {
  try {
    return await invoke<boolean>('test_connection', { host, port });
  } catch {
    return false;
  }
}

export async function measureLatency(host: string, port: number): Promise<number | null> {
  try {
    return await invoke<number | null>('measure_latency', { host, port });
  } catch {
    return null;
  }
}

// ── Session Management ──────────────────────────────────────────────

export async function connect(connectionId: string, frameChannel: Channel<FramePayload>): Promise<string> {
  return await invoke<string>('connect', { connectionId, frameChannel });
}

export async function disconnect(sessionId: string): Promise<void> {
  await invoke('disconnect', { sessionId });
}

export async function cancelReconnect(sessionId: string): Promise<void> {
  await invoke('cancel_reconnect', { sessionId });
}

export async function listSessions(): Promise<SessionInfo[]> {
  try {
    return await invoke<SessionInfo[]>('list_sessions');
  } catch {
    return [];
  }
}

export async function getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
  try {
    return await invoke<SessionInfo>('get_session_info', { sessionId });
  } catch {
    return null;
  }
}

export async function sendKeyEvent(sessionId: string, event: KeyEvent): Promise<void> {
  await invoke('send_key_event', {
    sessionId,
    keyCode: event.keyCode,
    isDown: event.isDown,
  });
}

export async function sendMouseEvent(sessionId: string, event: RdpMouseEvent): Promise<void> {
  await invoke('send_mouse_event', {
    sessionId,
    x: event.x,
    y: event.y,
    button: event.button ? String(event.button) : null,
    eventType: event.eventType,
    scrollDelta: event.scrollDelta ?? 0,
  });
}

export async function resizeSession(
  sessionId: string,
  width: number,
  height: number
): Promise<void> {
  await invoke('resize_session', { sessionId, width, height });
}

export async function getFrame(sessionId: string): Promise<string | null> {
  try {
    return await invoke<string>('get_frame', { sessionId });
  } catch {
    return null;
  }
}

export async function getConnectionPassword(id: string): Promise<string | null> {
  try {
    return await invoke<string>('get_connection_password', { id });
  } catch {
    return null;
  }
}

// ── SSH Config Import ────────────────────────────────────────────────

export async function importSshConfig(): Promise<number> {
  return await invoke<number>('import_ssh_config');
}

// ── Clipboard ────────────────────────────────────────────────────────

export async function clipboardWrite(sessionId: string, text: string): Promise<void> {
  await invoke('clipboard_write', { sessionId, text });
}

export async function clipboardRead(sessionId: string): Promise<string> {
  return await invoke<string>('clipboard_read', { sessionId });
}

// ── Settings ────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>('get_settings');
  } catch {
    return {
      theme: 'system',
      defaultPort: 3389,
      autoReconnect: true,
      showPerformanceHud: false,
      sidebarCollapsed: false,
      defaultResolution: '1920x1080',
      colorDepth: 32,
      quality: 80,
      reconnectTimeout: 5000,
      connectionTimeout: 10000,
    };
  }
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  return await invoke<AppSettings>('update_settings', { settings });
}
