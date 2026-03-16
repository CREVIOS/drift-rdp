import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [latencyVisible, setLatencyVisible] = useState(false);
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
      className="card-shadow group relative cursor-pointer overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-all duration-200 hover:ring-foreground/20"
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

      <div className="min-w-0 p-5">
        {/* Header: name + latency + menu */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span
              className={cn(
                'shrink-0 w-2.5 h-2.5 rounded-full transition-colors',
                testStatus === 'online' && 'pulse-online'
              )}
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
            >
              <Badge
                variant="outline"
                className="gap-1.5 text-[11px] font-medium border-transparent"
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
              </Badge>
            </motion.div>

            {/* Menu button */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="no-drag text-[var(--color-text-muted)] opacity-100 transition-opacity hover:text-[var(--color-text-secondary)] md:opacity-0 md:group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={4}>Options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={() => {
                    onEdit(connection);
                  }}
                >
                  <Pencil size={12} /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleDelete}
                >
                  <Trash2 size={12} /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Connection info */}
        <div className="space-y-1.5 mb-4">
          <p className="break-all text-[13px] font-mono tracking-tight text-[var(--color-text-secondary)]">
            {connection.host}:{connection.port}
          </p>
          {(connection.domain || connection.username) && (
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {connection.domain ? `${connection.domain}\\` : ''}
              {connection.username}
            </p>
          )}
        </div>

        {/* Tags */}
        {connection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {connection.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[11px] font-medium"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            <Clock size={12} />
            <span className="truncate">{relativeTime(connection.lastConnectedAt)}</span>
          </div>

          {/* Connect button - always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  size="sm"
                  className="no-drag w-full gap-2 text-xs font-semibold shadow-sm sm:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleConnect();
                  }}
                >
                  <Play size={12} fill="currentColor" />
                  Connect
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={4}>
              Connect to {connection.name}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
