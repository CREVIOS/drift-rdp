import { create } from 'zustand';
import type { AppSettings } from '../types';
import * as tauri from '../lib/tauri';

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
}

const defaultSettings: AppSettings = {
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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      const settings = await tauri.getSettings();
      set({ settings, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (partial) => {
    const merged = { ...get().settings, ...partial };
    set({ settings: merged });
    try {
      await tauri.updateSettings(partial);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },
}));
