import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSessionStore } from '../../stores/sessionStore';
import { useSettingsStore } from '../../stores/settingsStore';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

// Custom SVG icons
function BoltIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M13 2L4.09 12.64a1 1 0 00.78 1.62H11l-1 7.74a.5.5 0 00.86.4L19.91 11.36a1 1 0 00-.78-1.62H13l1-7.74a.5.5 0 00-.86-.4z"
        fill="currentColor"
      />
    </svg>
  );
}

function ConnectionsIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function SettingsIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SessionsIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <circle cx="12" cy="10" r="2" fill="currentColor" stroke="none" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </svg>
  );
}

function CollapseLeftIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M16 15l-3-3 3-3" />
    </svg>
  );
}

function CollapseRightIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M14 9l3 3-3 3" />
    </svg>
  );
}

const navItems = [
  { path: '/', icon: ConnectionsIcon, label: 'Connections' },
  { path: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const collapsed = useSettingsStore((s) => s.settings.sidebarCollapsed);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  const sessionCount = sessions.size;

  const toggleCollapse = () => {
    updateSettings({ sidebarCollapsed: !collapsed });
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden"
      style={{ height: '100%' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3.5 px-5 py-6 shrink-0">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 shadow-md overflow-hidden">
          <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#drift-sb)" />
            <path d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <path d="M11 16C11 13.239 13.239 11 16 11C18.761 11 21 13.239 21 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <circle cx="16" cy="16" r="2.5" fill="white" />
            <path d="M16 18.5V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M13 22L16 24L19 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            <defs>
              <linearGradient id="drift-sb" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[15px] font-bold text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden tracking-tight"
            >
              Drift
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="mx-4 mb-3 border-t border-[var(--color-border)]" />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-4 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                relative flex items-center gap-3.5 px-3.5 py-3 rounded-xl transition-all duration-150 text-left
                ${
                  isActive
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[var(--color-accent)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon size={20} className="shrink-0" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        {/* Active Sessions Badge */}
        {sessionCount > 0 && (
          <button
            onClick={() => {
              const activeId = useSessionStore.getState().activeSessionId;
              if (activeId) navigate(`/session/${activeId}`);
            }}
            className="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-all duration-150"
          >
            <div className="relative shrink-0">
              <SessionsIcon size={20} />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-[18px] h-[18px] text-[10px] font-bold text-white bg-[var(--color-success)] rounded-full ring-2 ring-[var(--color-surface-1)]">
                {sessionCount}
              </span>
            </div>
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
                >
                  Active Sessions
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="px-4 py-4 border-t border-[var(--color-border)]">
        <button
          onClick={toggleCollapse}
          className="flex items-center justify-center w-full py-2.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-all duration-150"
        >
          {collapsed ? <CollapseRightIcon /> : <CollapseLeftIcon />}
        </button>
      </div>
    </motion.aside>
  );
}
