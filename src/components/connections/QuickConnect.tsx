import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Monitor, ArrowRight, Command } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';

export function QuickConnect() {
  const navigate = useNavigate();
  const show = useSessionStore((s) => s.showQuickConnect);
  const setShow = useSessionStore((s) => s.setShowQuickConnect);
  const connections = useConnectionStore((s) => s.connections);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query
    ? connections.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.host.toLowerCase().includes(query.toLowerCase())
      )
    : connections.slice(0, 8);

  useEffect(() => {
    if (show) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleConnect = useCallback(
    (connectionId: string) => {
      setShow(false);
      navigate(`/session/${connectionId}`);
    },
    [navigate, setShow]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered.length > 0 && filtered[selectedIndex]) {
        e.preventDefault();
        handleConnect(filtered[selectedIndex].id);
      } else if (e.key === 'Escape') {
        setShow(false);
      }
    },
    [filtered, selectedIndex, handleConnect, setShow]
  );

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onClick={() => setShow(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b border-[var(--color-border)]">
          <Search size={18} className="text-[var(--color-text-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search connections or enter hostname..."
            className="flex-1 py-4 text-sm bg-transparent text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-3)] rounded">
            <Command size={10} />K
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Monitor size={24} className="text-[var(--color-text-muted)] mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">
                {query ? 'No connections match your search' : 'No saved connections'}
              </p>
            </div>
          ) : (
            filtered.map((conn, i) => (
              <button
                key={conn.id}
                onClick={() => handleConnect(conn.id)}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`flex items-center justify-between w-full px-5 py-2.5 text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-[var(--color-accent)]/10'
                    : 'hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (conn.colorAccent || '#6366f1') + '22' }}
                  >
                    <Monitor size={14} style={{ color: conn.colorAccent || '#6366f1' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {conn.name}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)] font-mono truncate">
                      {conn.host}:{conn.port}
                    </p>
                  </div>
                </div>
                {i === selectedIndex && (
                  <div className="flex items-center gap-1 text-[var(--color-accent)]">
                    <span className="text-[10px] font-medium">Connect</span>
                    <ArrowRight size={12} />
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)]">&#x2191;&#x2193;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)]">&#x23ce;</kbd>
            Connect
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[var(--color-surface-3)]">Esc</kbd>
            Close
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
