import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Command } from 'lucide-react';

interface Props {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const sections: Section[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['\u2318', 'K'], description: 'Quick Connect' },
      { keys: ['\u2318', 'N'], description: 'New Connection' },
      { keys: ['\u2318', ','], description: 'Settings' },
    ],
  },
  {
    title: 'Session',
    shortcuts: [
      { keys: ['Esc'], description: 'Disconnect menu' },
      { keys: ['Ctrl', 'Shift', 'P'], description: 'Performance HUD' },
      { keys: ['F11'], description: 'Fullscreen' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['\u2318', '?'], description: 'This help' },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  const isSymbol = children === '\u2318';
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md text-[11px] font-medium bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-secondary)] shadow-[0_1px_0_1px_var(--color-surface-0)]">
      {isSymbol ? <Command size={11} /> : children}
    </kbd>
  );
}

export function ShortcutOverlay({ onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 10 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Navigate faster with keyboard shortcuts
          </p>
        </div>

        {/* Sections */}
        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2.5">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <KeyCap key={i}>{key}</KeyCap>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-text-muted)] text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)] text-[10px]">Esc</kbd> to close
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
