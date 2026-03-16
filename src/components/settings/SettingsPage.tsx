import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, MonitorCog, Info } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks/useTheme';

const RESOLUTIONS = [
  '1920x1080',
  '1600x900',
  '1366x768',
  '1280x720',
  '2560x1440',
  '3840x2160',
];

export function SettingsPage() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
            Settings
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mb-8">
            Configure your preferences
          </p>

          {/* General */}
          <Section title="General">
            {/* Theme */}
            <SettingRow label="Theme" description="Choose your preferred color scheme">
              <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] overflow-hidden">
                {(['system', 'light', 'dark'] as const).map((t) => {
                  const Icon =
                    t === 'system' ? MonitorCog : t === 'light' ? Sun : Moon;
                  return (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                        theme === t
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]'
                      }`}
                    >
                      <Icon size={12} />
                      {t}
                    </button>
                  );
                })}
              </div>
            </SettingRow>

            {/* Default Port */}
            <SettingRow label="Default Port" description="Default RDP port for new connections">
              <input
                type="number"
                value={settings.defaultPort}
                onChange={(e) =>
                  updateSettings({ defaultPort: Number(e.target.value) })
                }
                className="w-24 px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </SettingRow>
          </Section>

          {/* Display */}
          <Section title="Display">
            <SettingRow
              label="Default Resolution"
              description="Resolution for new connections"
            >
              <select
                value={settings.defaultResolution}
                onChange={(e) =>
                  updateSettings({ defaultResolution: e.target.value })
                }
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Color Depth" description="Bits per pixel">
              <select
                value={settings.colorDepth}
                onChange={(e) =>
                  updateSettings({ colorDepth: Number(e.target.value) })
                }
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                <option value={16}>16-bit</option>
                <option value={24}>24-bit</option>
                <option value={32}>32-bit</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Quality"
              description={`Image quality: ${settings.quality}%`}
            >
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={settings.quality}
                onChange={(e) =>
                  updateSettings({ quality: Number(e.target.value) })
                }
                className="w-32 accent-[var(--color-accent)]"
              />
            </SettingRow>
          </Section>

          {/* Network */}
          <Section title="Network">
            <SettingRow
              label="Auto-reconnect"
              description="Automatically reconnect on connection loss"
            >
              <Toggle
                checked={settings.autoReconnect}
                onChange={(v) => updateSettings({ autoReconnect: v })}
              />
            </SettingRow>

            <SettingRow
              label="Reconnect Timeout"
              description="Wait time before reconnection attempt"
            >
              <select
                value={settings.reconnectTimeout}
                onChange={(e) =>
                  updateSettings({ reconnectTimeout: Number(e.target.value) })
                }
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                <option value={3000}>3 seconds</option>
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Connection Timeout"
              description="Max wait time for initial connection"
            >
              <select
                value={settings.connectionTimeout}
                onChange={(e) =>
                  updateSettings({ connectionTimeout: Number(e.target.value) })
                }
                className="px-3 py-1.5 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                <option value={5000}>5 seconds</option>
                <option value={10000}>10 seconds</option>
                <option value={30000}>30 seconds</option>
                <option value={60000}>60 seconds</option>
              </select>
            </SettingRow>
          </Section>

          {/* About */}
          <Section title="About">
            <div className="flex items-start gap-4 p-5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
              <div className="shrink-0">
                <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="8" fill="url(#drift-about)" />
                  <path d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                  <path d="M11 16C11 13.239 13.239 11 16 11C18.761 11 21 13.239 21 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                  <circle cx="16" cy="16" r="2.5" fill="white" />
                  <path d="M16 18.5V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M13 22L16 24L19 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  <defs>
                    <linearGradient id="drift-about" x1="0" y1="0" x2="32" y2="32">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="50%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                  Drift
                </h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  Version 0.1.0
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-2 leading-relaxed">
                  A beautiful, high-performance remote desktop client.
                  Built with Tauri, React, and IronRDP.
                </p>
              </div>
            </div>
          </Section>
        </motion.div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="space-y-1 rounded-xl border border-[var(--color-border)] overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] last:border-b-0">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-4)]'
      }`}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm"
      />
    </button>
  );
}
