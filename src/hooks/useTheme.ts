import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const applyTheme = useCallback((theme: 'system' | 'light' | 'dark') => {
    const root = document.documentElement;

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme, applyTheme]);

  useEffect(() => {
    if (settings.theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme, applyTheme]);

  const toggle = useCallback(() => {
    const current = settings.theme;
    const next: 'system' | 'light' | 'dark' =
      current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark';
    updateSettings({ theme: next });
  }, [settings.theme, updateSettings]);

  const setTheme = useCallback(
    (theme: 'system' | 'light' | 'dark') => {
      updateSettings({ theme });
    },
    [updateSettings]
  );

  return { theme: settings.theme, toggle, setTheme };
}
