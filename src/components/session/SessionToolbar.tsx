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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

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
          className="absolute top-0 left-1/2 z-30 mt-2 w-[min(calc(100%-1rem),42rem)] -translate-x-1/2"
          onMouseEnter={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
          }}
          onMouseLeave={() => {
            timerRef.current = setTimeout(() => setVisible(false), 1500);
          }}
        >
          <div className="glass flex items-center gap-1 overflow-hidden rounded-xl px-2 py-1.5 shadow-2xl">
            {/* Connection info */}
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1">
              <Monitor size={12} className="text-[var(--color-accent)]" />
              <span className="truncate text-[11px] font-medium text-[var(--color-text-primary)]">
                {hostname}
              </span>
              <span className="hidden text-[10px] font-mono text-[var(--color-text-muted)] sm:inline">
                {resolution}
              </span>
            </div>

            <Separator orientation="vertical" className="hidden h-5 sm:block" />

            {/* Stats */}
            <div className="hidden items-center gap-2 px-3 py-1 sm:flex">
              <Badge variant="secondary" className="text-[10px] font-mono gap-1">
                {fps} FPS
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono gap-1">
                {latency}ms
              </Badge>
            </div>

            <Separator orientation="vertical" className="h-5 shrink-0" />

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-0.5 px-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onFullscreen}
                  >
                    {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onCtrlAltDel}
                  >
                    <Keyboard size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>Ctrl+Alt+Del</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={togglePerformanceHud}
                  >
                    <BarChart3 size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>Performance HUD</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={onScreenshot}
                  >
                    <Camera size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>Screenshot</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon-xs"
                    onClick={onDisconnect}
                  >
                    <LogOut size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>Disconnect</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
