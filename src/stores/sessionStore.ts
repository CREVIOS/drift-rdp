import { create } from 'zustand';
import type { SessionInfo } from '../types';

interface SessionState {
  sessions: Map<string, SessionInfo>;
  activeSessionId: string | null;
  showPerformanceHud: boolean;
  showQuickConnect: boolean;

  addSession: (session: SessionInfo) => void;
  removeSession: (sessionId: string) => void;
  updateSession: (sessionId: string, info: Partial<SessionInfo>) => void;
  setActive: (sessionId: string | null) => void;
  togglePerformanceHud: () => void;
  toggleQuickConnect: () => void;
  setShowQuickConnect: (show: boolean) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: new Map(),
  activeSessionId: null,
  showPerformanceHud: false,
  showQuickConnect: false,

  addSession: (session) => {
    const sessions = new Map(get().sessions);
    sessions.set(session.id, session);
    set({ sessions, activeSessionId: session.id });
  },

  removeSession: (sessionId) => {
    const sessions = new Map(get().sessions);
    sessions.delete(sessionId);
    const activeSessionId =
      get().activeSessionId === sessionId
        ? sessions.size > 0
          ? sessions.keys().next().value ?? null
          : null
        : get().activeSessionId;
    set({ sessions, activeSessionId });
  },

  updateSession: (sessionId, info) => {
    const sessions = new Map(get().sessions);
    const existing = sessions.get(sessionId);
    if (existing) {
      sessions.set(sessionId, { ...existing, ...info });
      set({ sessions });
    }
  },

  setActive: (sessionId) => set({ activeSessionId: sessionId }),

  togglePerformanceHud: () =>
    set({ showPerformanceHud: !get().showPerformanceHud }),

  toggleQuickConnect: () =>
    set({ showQuickConnect: !get().showQuickConnect }),

  setShowQuickConnect: (show) => set({ showQuickConnect: show }),
}));
