import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize,
  Minimize,
  Keyboard,
  BarChart3,
  Camera,
  LogOut,
  Monitor,
} from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  hostname: string;
  resolution: string;
  fps: number;
  latency: number;
  onFullscreen: () => void;
  onCtrlAltDel: () => void;
  onScreenshot: () => void;
  onDisconnect: () => void;
  isFullscreen: boolean;
}

export function SessionToolbar({
  hostname,
  resolution,
  fps,
  latency,
  onFullscreen,
  onCtrlAltDel,
  onScreenshot,
  onDisconnect,
  isFullscreen,
}: Props) {
  const [visible, setVisible] = useState(false);
  const togglePerformanceHud = useSessionStore((s) => s.togglePerformanceHud);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY < 60) {
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setVisible(false), 3000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-30 mt-2"
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={() => {
            timerRef.current = setTimeout(() => setVisible(false), 1500);
          }}
        >
          <div className="glass flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-2xl">
            {/* Connection info */}
            <div className="flex items-center gap-2 px-3 py-1 border-r border-[var(--color-border)]">
              <Monitor size={12} className="text-[var(--color-accent)]" />
              <span className="text-[11px] font-medium text-[var(--color-text-primary)]">
                {hostname}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {resolution}
              </span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 px-3 py-1 border-r border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
              <span>{fps} FPS</span>
              <span>{latency}ms</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 px-1">
              <ToolbarButton
                icon={isFullscreen ? Minimize : Maximize}
                label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                onClick={onFullscreen}
              />
              <ToolbarButton
                icon={Keyboard}
                label="Ctrl+Alt+Del"
                onClick={onCtrlAltDel}
              />
              <ToolbarButton
                icon={BarChart3}
                label="Performance HUD"
                onClick={togglePerformanceHud}
              />
              <ToolbarButton
                icon={Camera}
                label="Screenshot"
                onClick={onScreenshot}
              />
              <ToolbarButton
                icon={LogOut}
                label="Disconnect"
                onClick={onDisconnect}
                danger
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-2 rounded-lg transition-colors ${
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]'
      }`}
    >
      <Icon size={14} />
    </button>
  );
}
