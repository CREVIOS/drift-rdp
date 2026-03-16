import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { Minus, Square, X } from 'lucide-react';

export function Titlebar() {
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const os = platform();
        setIsMac(os === 'macos');
      } catch {
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    })();
  }, []);

  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  return (
    <div
      className="drag-region flex items-center justify-between shrink-0 select-none bg-[var(--color-surface-0)]"
      style={{ height: 52, borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Left: Traffic light space (macOS native) + Logo */}
      <div className="flex items-center gap-2.5 no-drag" style={{ paddingLeft: isMac ? 78 : 16 }}>
        {/* Drift logo */}
        <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#drift-tb)" />
          <path d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          <path d="M11 16C11 13.239 13.239 11 16 11C18.761 11 21 13.239 21 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
          <circle cx="16" cy="16" r="2.5" fill="white" />
          <path d="M16 18.5V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
          <path d="M13 22L16 24L19 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          <defs>
            <linearGradient id="drift-tb" x1="0" y1="0" x2="32" y2="32">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <span className="text-sm font-bold tracking-tight text-[var(--color-text-primary)]">
          Drift
        </span>
      </div>

      {/* Center: drag region */}
      <div className="flex-1" />

      {/* Right: Window controls for Linux/Windows (macOS uses native traffic lights) */}
      {!isMac && (
        <div className="flex items-center h-full no-drag">
          <button
            onClick={handleMinimize}
            className="flex items-center justify-center w-[46px] h-full hover:bg-[var(--color-surface-3)] transition-colors"
          >
            <Minus size={14} className="text-[var(--color-text-muted)]" />
          </button>
          <button
            onClick={handleMaximize}
            className="flex items-center justify-center w-[46px] h-full hover:bg-[var(--color-surface-3)] transition-colors"
          >
            <Square size={11} className="text-[var(--color-text-muted)]" />
          </button>
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-[46px] h-full hover:bg-[var(--color-danger)] transition-colors group"
          >
            <X size={14} className="text-[var(--color-text-muted)] group-hover:text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
