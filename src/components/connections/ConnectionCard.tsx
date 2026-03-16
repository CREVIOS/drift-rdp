import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimationControls } from 'framer-motion';
import {
  MoreVertical,
  Play,
  Pencil,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react';
import type { ConnectionConfig } from '../../types';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToastStore } from '../../stores/toastStore';
import * as tauri from '../../lib/tauri';

const DEFAULT_ACCENT = '#6366f1';

type ConnectionState = 'idle' | 'connecting';

interface Props {
  connection: ConnectionConfig;
  index: number;
  onEdit: (connection: ConnectionConfig) => void;
}

type TestStatus = 'unknown' | 'testing' | 'online' | 'error';

export function ConnectionCard({ connection, index, onEdit }: Props) {
  const navigate = useNavigate();
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const addToast = useToastStore((s) => s.addToast);
  const [testStatus, setTestStatus] = useState<TestStatus>('unknown');
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [showMenu, setShowMenu] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [latencyVisible, setLatencyVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardControls = useAnimationControls();

  // Measure latency on mount with a small random delay to stagger pings
  useEffect(() => {
    const delay = Math.random() * 2000;
    const timer = setTimeout(async () => {
      const ms = await tauri.measureLatency(connection.host, connection.port);
      setLatencyMs(ms);
      if (ms !== null) {
        // Small delay before showing badge for animation
        requestAnimationFrame(() => setLatencyVisible(true));
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [connection.host, connection.port]);

  const latencyColor =
    latencyMs === null
      ? '#9ca3af' // gray
      : latencyMs < 50
        ? '#22c55e' // green
        : latencyMs < 150
          ? '#eab308' // yellow
          : '#ef4444'; // red

  const handleConnect = () => {
    setConnectionState('connecting');
    setTimeout(() => {
      navigate(`/session/${connection.id}`);
    }, 500);
  };

  // Initial mount animation
  useEffect(() => {
    const timer = setTimeout(() => {
      cardControls.start({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.3, delay: index * 0.05 },
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [cardControls, index]);

  // Animate card based on test status transitions
  useEffect(() => {
    if (testStatus === 'testing') {
      cardControls.start({
        boxShadow: [
          '0 0 0px rgba(99, 102, 241, 0)',
          '0 0 12px rgba(99, 102, 241, 0.6)',
          '0 0 0px rgba(99, 102, 241, 0)',
        ],
        transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
      });
    } else if (testStatus === 'online') {
      cardControls.start({
        boxShadow: [
          '0 0 0px rgba(34, 197, 94, 0)',
          '0 0 16px rgba(34, 197, 94, 0.7)',
          '0 0 0px rgba(34, 197, 94, 0)',
        ],
        transition: { duration: 0.6, ease: 'easeOut' },
      });
    } else if (testStatus === 'error') {
      cardControls.start({
        x: [0, -4, 4, -4, 4, 0],
        transition: { duration: 0.4, ease: 'easeInOut' },
      });
    } else {
      cardControls.stop();
      cardControls.set({ boxShadow: '0 0 0px rgba(0,0,0,0)', x: 0 });
    }
  }, [testStatus, cardControls]);

  const handleTest = async () => {
    setTestStatus('testing');
    const start = Date.now();
    const ok = await tauri.testConnection(connection.host, connection.port);
    const latency = Date.now() - start;
    setTestStatus(ok ? 'online' : 'error');
    if (ok) {
      addToast({ message: `Connected to ${connection.host} (${latency}ms)`, type: 'success' });
    } else {
      addToast({ message: `Cannot reach ${connection.host}`, type: 'error' });
    }
  };

  const handleDelete = async () => {
    setShowMenu(false);
    await deleteConnection(connection.id);
  };

  const relativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Never connected';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const statusColor =
    testStatus === 'online'
      ? 'var(--color-success)'
      : testStatus === 'error'
        ? 'var(--color-danger)'
        : 'var(--color-text-muted)';

  return (
    <motion.div
      layout
      layoutId={`connection-${connection.id}`}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={cardControls}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ y: -3 }}
      className="relative rounded-xl overflow-hidden cursor-pointer group bg-[var(--color-surface-1)] border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all duration-200"
      onClick={handleTest}
    >
      {/* Connecting spinner overlay */}
      {connectionState === 'connecting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 size={24} className="text-white" />
          </motion.div>
          <span className="ml-2 text-sm text-white font-medium">Connecting...</span>
        </motion.div>
      )}

      {/* Color accent strip */}
      <div
        className="h-[3px] w-full"
        style={{ background: connection.colorAccent || DEFAULT_ACCENT }}
      />

      <div className="p-5">
        {/* Header: name + latency + menu */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span
              className={`shrink-0 w-2.5 h-2.5 rounded-full transition-colors ${testStatus === 'online' ? 'pulse-online' : ''}`}
              style={{ background: statusColor }}
            />
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)] truncate">
              {connection.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Latency badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                opacity: latencyVisible ? 1 : 0,
                scale: latencyVisible ? 1 : 0.7,
              }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: `${latencyColor}15`,
                color: latencyColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: latencyColor }}
              />
              {latencyMs !== null ? `${latencyMs}ms` : '...'}
            </motion.div>

            {/* Menu button */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="no-drag p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors opacity-0 group-hover:opacity-100"
              >
                <MoreVertical size={14} />
              </button>

              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-9 z-50 w-36 py-1.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(connection);
                    }}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Connection info */}
        <div className="space-y-1.5 mb-4">
          <p className="text-[13px] text-[var(--color-text-secondary)] font-mono tracking-tight">
            {connection.host}:{connection.port}
          </p>
          {(connection.domain || connection.username) && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {connection.domain ? `${connection.domain}\\` : ''}
              {connection.username}
            </p>
          )}
        </div>

        {/* Tags */}
        {connection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {connection.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Clock size={12} />
            <span>{relativeTime(connection.lastConnectedAt)}</span>
          </div>

          {/* Connect button - always visible */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleConnect();
            }}
            className="no-drag flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
          >
            <Play size={12} fill="currentColor" />
            Connect
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
