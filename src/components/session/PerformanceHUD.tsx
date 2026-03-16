import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Gauge, MonitorDot, Wifi } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  const fpsLevel: 'good' | 'medium' | 'bad' =
    fps >= 24 ? 'good' : fps >= 15 ? 'medium' : 'bad';

  const latencyLevel: 'good' | 'medium' | 'bad' =
    latency < 50 ? 'good' : latency < 150 ? 'medium' : 'bad';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute top-3 right-3 z-20 w-52"
        >
          <Card
            className="overflow-hidden border-0 gap-0 py-0"
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
                level={fpsLevel}
              />
              <HUDRow
                icon={Wifi}
                label="Latency"
                value={`${latency}ms`}
                level={latencyLevel}
              />
              <HUDRow
                icon={Gauge}
                label="Bandwidth"
                value={formatBandwidth(bandwidth)}
                level="info"
              />
              <HUDRow
                icon={MonitorDot}
                label="Resolution"
                value={resolution}
                level="neutral"
              />
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type HUDLevel = 'good' | 'medium' | 'bad' | 'info' | 'neutral';

const levelColors: Record<HUDLevel, string> = {
  good: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  bad: 'bg-red-500/20 text-red-400 border-red-500/30',
  info: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  neutral: 'bg-white/10 text-white/70 border-white/10',
};

const levelIconColors: Record<HUDLevel, string> = {
  good: 'text-green-400',
  medium: 'text-yellow-400',
  bad: 'text-red-400',
  info: 'text-indigo-400',
  neutral: 'text-white/60',
};

function HUDRow({
  icon: Icon,
  label,
  value,
  level,
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  label: string;
  value: string;
  level: HUDLevel;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={levelIconColors[level]} />
        <span className="text-[11px] text-white/50">{label}</span>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] font-mono font-medium h-4 px-1.5',
          levelColors[level]
        )}
      >
        {value}
      </Badge>
    </div>
  );
}
