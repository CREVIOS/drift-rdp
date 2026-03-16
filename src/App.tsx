import { useEffect, useState, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Titlebar } from './components/layout/Titlebar';
import { Sidebar } from './components/layout/Sidebar';
import { StatusBar } from './components/layout/StatusBar';
import { ConnectionGrid } from './components/connections/ConnectionGrid';
import { ConnectionForm } from './components/connections/ConnectionForm';
import { QuickConnect } from './components/connections/QuickConnect';
import { SessionView } from './components/session/SessionView';
import { SettingsPage } from './components/settings/SettingsPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { useTheme } from './hooks/useTheme';
import { useKeyboard } from './hooks/useKeyboard';
import { useSettingsStore } from './stores/settingsStore';
import { useConnectionStore } from './stores/connectionStore';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function App() {
  const fetchSettings = useSettingsStore((s) => s.fetchSettings);
  const fetchConnections = useConnectionStore((s) => s.fetchConnections);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Initialize theme
  useTheme();

  // Initialize data
  useEffect(() => {
    fetchSettings();
    fetchConnections();
  }, [fetchSettings, fetchConnections]);

  // Keyboard shortcuts
  const handleNewConnection = useCallback(() => {
    setShowNewConnection(true);
  }, []);

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts((prev) => !prev);
  }, []);

  useKeyboard({ onNewConnection: handleNewConnection, onShowShortcuts: handleShowShortcuts });

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-surface-0)]">
        {/* Titlebar */}
        <Titlebar />

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <Sidebar />

          {/* Page content */}
          <main className="flex-1 min-w-0 overflow-hidden">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<ConnectionGrid />} />
                <Route path="/session/:id" element={<SessionView />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>

        {/* Status Bar */}
        <StatusBar />

        {/* Toast Notifications */}
        <ToastContainer />

        {/* Quick Connect Modal */}
        <QuickConnect />

        {/* New Connection Modal (from Cmd+N) */}
        <AnimatePresence>
          {showNewConnection && (
            <ConnectionForm
              connection={null}
              onClose={() => setShowNewConnection(false)}
            />
          )}
        </AnimatePresence>

        {/* Shortcut Overlay (Cmd+?) */}
        <AnimatePresence>
          {showShortcuts && (
            <ShortcutOverlay onClose={() => setShowShortcuts(false)} />
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
