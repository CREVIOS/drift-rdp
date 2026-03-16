import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Zap, Check } from 'lucide-react';
import type { ConnectionConfig } from '../../types';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import * as tauri from '../../lib/tauri';

interface Props {
  connection: ConnectionConfig | null;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
];

const RESOLUTIONS = [
  '1920x1080',
  '1600x900',
  '1366x768',
  '1280x720',
  '2560x1440',
  '3840x2160',
];

export function ConnectionForm({ connection, onClose }: Props) {
  const createConnection = useConnectionStore((s) => s.createConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);
  const defaultPort = useSettingsStore((s) => s.settings.defaultPort);
  const addToast = useToastStore((s) => s.addToast);

  const isEdit = !!connection;

  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(connection?.host ?? '');
  const [port, setPort] = useState(connection?.port ?? defaultPort);
  const [username, setUsername] = useState(connection?.username ?? '');
  const [password, setPassword] = useState(connection?.password ?? '');
  const [domain, setDomain] = useState(connection?.domain ?? '');
  const [colorAccent, setColorAccent] = useState(connection?.colorAccent || PRESET_COLORS[0]);
  const [tagsInput, setTagsInput] = useState(connection?.tags.join(', ') ?? '');
  const [resolution, setResolution] = useState(
    connection ? `${connection.displayWidth ?? 1920}x${connection.displayHeight ?? 1080}` : '1920x1080'
  );
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!host.trim()) errs.host = 'Host is required';
    if (!port || port < 1 || port > 65535) errs.port = 'Invalid port';
    if (!username.trim()) errs.username = 'Username is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (isSubmitting) return;

    const parts = resolution.split('x').map(Number);
    let w = parts[0];
    let h = parts[1];
    if (isNaN(w) || isNaN(h)) {
      w = 1920;
      h = 1080;
    }
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      if (isEdit && connection) {
        await updateConnection(connection.id, {
          name,
          host,
          port,
          username,
          password: password || undefined,
          domain,
          colorAccent,
          tags,
          displayWidth: w,
          displayHeight: h,
        });
      } else {
        await createConnection({
          name,
          host,
          port,
          username,
          password: password || undefined,
          domain,
          colorAccent,
          tags,
          displayWidth: w,
          displayHeight: h,
          lastConnectedAt: undefined,
        });
      }
      addToast({ message: 'Connection saved', type: 'success' });
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save connection';
      addToast({ message, type: 'error' });
      console.error('Failed to save connection:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!host || !port) return;
    setTestResult('testing');
    try {
      const ok = await tauri.testConnection(host, port);
      setTestResult(ok ? 'success' : 'fail');
    } catch {
      setTestResult('fail');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 10 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
      >
        {/* Color accent strip */}
        <div className="h-1 w-full" style={{ background: colorAccent }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEdit ? 'Edit Connection' : 'New Connection'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Connection Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Server"
              className={`w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border ${errors.name ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'} text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors`}
            />
            {errors.name && (
              <p className="text-[10px] text-[var(--color-danger)] mt-1">{errors.name}</p>
            )}
          </div>

          {/* Host + Port row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Host
              </label>
              <input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                maxLength={253}
                placeholder="192.168.1.100"
                className={`w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border ${errors.host ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'} text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors`}
              />
              {errors.host && (
                <p className="text-[10px] text-[var(--color-danger)] mt-1">{errors.host}</p>
              )}
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className={`w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border ${errors.port ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'} text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors`}
              />
            </div>
          </div>

          {/* Username + Domain */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className={`w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border ${errors.username ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'} text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors`}
              />
              {errors.username && (
                <p className="text-[10px] text-[var(--color-danger)] mt-1">{errors.username}</p>
              )}
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                Domain
              </label>
              <input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="WORKGROUP"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColorAccent(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center"
                  style={{
                    background: c,
                    borderColor: colorAccent === c ? 'white' : 'transparent',
                  }}
                >
                  {colorAccent === c && <Check size={12} className="text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Tags (comma separated)
            </label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="production, web-server"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Display settings */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Resolution
            </label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={handleTest}
            disabled={!host || !port}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Zap size={12} />
            {testResult === 'testing'
              ? 'Testing...'
              : testResult === 'success'
                ? 'Connected!'
                : testResult === 'fail'
                  ? 'Failed'
                  : 'Test Connection'}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Connection'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
