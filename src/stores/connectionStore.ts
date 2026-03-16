import { create } from 'zustand';
import type { ConnectionConfig } from '../types';
import * as tauri from '../lib/tauri';

interface ConnectionState {
  connections: ConnectionConfig[];
  selectedId: string | null;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  isLoading: boolean;
  error: string | null;

  setSelectedId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  fetchConnections: () => Promise<void>;
  createConnection: (
    config: Omit<ConnectionConfig, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<ConnectionConfig>;
  updateConnection: (id: string, config: Partial<ConnectionConfig>) => Promise<void>;
  deleteConnection: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  selectedId: null,
  searchQuery: '',
  viewMode: 'grid',
  isLoading: false,
  error: null,

  setSelectedId: (id) => set({ selectedId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setViewMode: (mode) => set({ viewMode: mode }),

  fetchConnections: async () => {
    set({ isLoading: true, error: null });
    try {
      const connections = await tauri.listConnections();
      set({ connections, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createConnection: async (config) => {
    const connection = await tauri.createConnection(config);
    set({ connections: [...get().connections, connection] });
    return connection;
  },

  updateConnection: async (id, config) => {
    const updated = await tauri.updateConnection(id, config);
    set({
      connections: get().connections.map((c) => (c.id === id ? updated : c)),
    });
  },

  deleteConnection: async (id) => {
    await tauri.deleteConnection(id);
    set({
      connections: get().connections.filter((c) => c.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

}));
