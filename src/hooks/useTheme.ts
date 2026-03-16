import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export function useTheme() {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const applyTheme = useCallback((theme: 'system' | 'light' | 'dark') => {
    const root = document.documentElement;
    let resolved: 'light' | 'dark';

    if (theme === 'system') {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolved = theme;
    }

    // Set both data-theme (our custom) and class (shadcn uses .dark/.light)
    root.setAttribute('data-theme', resolved);
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
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
