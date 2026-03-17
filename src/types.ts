export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  domain: string;
  password?: string;
  colorAccent: string | null;
  tags: string[];
  displayWidth: number | null;
  displayHeight: number | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
}

export type SessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface SessionInfo {
  id: string;
  connectionId: string;
  connectionName: string;
  host: string;
  status: SessionStatus;
  fps: number;
  latency: number;
  bandwidth: number;
  width: number;
  height: number;
  connectedAt?: string;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastError?: string | null;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  defaultPort: number;
  autoReconnect: boolean;
  showPerformanceHud: boolean;
  sidebarCollapsed: boolean;
  defaultResolution: string;
  colorDepth: number;
  quality: number;
  reconnectTimeout: number;
  connectionTimeout: number;
}

export interface KeyEvent {
  keyCode: number;
  isDown: boolean;
}

export interface MouseEvent {
  x: number;
  y: number;
  button: number;
  eventType: 'move' | 'down' | 'up' | 'scroll';
  scrollDelta?: number;
}
