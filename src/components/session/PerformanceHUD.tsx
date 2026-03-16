import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Gauge, MonitorDot, Wifi } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';

interface Props {
  fps: number;
  latency: number;
  bandwidth: number;
  resolution: string;
}

export function PerformanceHUD({ fps, latency, bandwidth, resolution }: Props) {
  const show = useSessionStore((s) => s.showPerformanceHud);

  const formatBandwidth = (bps: number) => {
    if (bps < 1024) return `${bps} B/s`;
    if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
    return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const fpsColor =
    fps >= 24
      ? 'var(--color-success)'
      : fps >= 15
        ? 'var(--color-warning)'
        : 'var(--color-danger)';

  const latencyColor =
    latency < 50
      ? 'var(--color-success)'
      : latency < 150
        ? 'var(--color-warning)'
        : 'var(--color-danger)';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-3 right-3 z-20 w-48 rounded-xl overflow-hidden"
          style={{
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="px-3 py-2 border-b border-white/5">
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
              Performance
            </span>
          </div>
          <div className="p-3 space-y-2.5">
            <HUDRow
              icon={Activity}
              label="FPS"
              value={String(fps)}
              color={fpsColor}
            />
            <HUDRow
              icon={Wifi}
              label="Latency"
              value={`${latency}ms`}
              color={latencyColor}
            />
            <HUDRow
              icon={Gauge}
              label="Bandwidth"
              value={formatBandwidth(bandwidth)}
              color="var(--color-accent)"
            />
            <HUDRow
              icon={MonitorDot}
              label="Resolution"
              value={resolution}
              color="var(--color-text-secondary)"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HUDRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ size: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={11} style={{ color }} />
        <span className="text-[11px] text-white/50">{label}</span>
      </div>
      <span className="text-[11px] font-mono font-medium" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
