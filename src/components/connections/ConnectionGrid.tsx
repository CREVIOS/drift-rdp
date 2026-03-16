import { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Monitor,
  ChevronDown,
  FileDown,
  Terminal,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToastStore } from '../../stores/toastStore';
import { ConnectionCard } from './ConnectionCard';
import { ConnectionForm } from './ConnectionForm';
import type { ConnectionConfig } from '../../types';
import * as tauri from '../../lib/tauri';

export function ConnectionGrid() {
  const {
    connections,
    searchQuery,
    viewMode,
    isLoading,
    setSearchQuery,
    setViewMode,
    fetchConnections,
  } = useConnectionStore();

  const addToast = useToastStore((s) => s.addToast);
  const [showForm, setShowForm] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  // Close import menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
    };
    if (showImportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showImportMenu]);

  const handleImportSshConfig = async () => {
    setShowImportMenu(false);
    try {
      const count = await tauri.importSshConfig();
      await fetchConnections();
      addToast({
        message: `Imported ${count} connection${count !== 1 ? 's' : ''} from SSH config`,
        type: 'success',
      });
    } catch (e) {
      addToast({
        message: `SSH import failed: ${String(e)}`,
        type: 'error',
      });
    }
  };

  const filtered = useMemo(() => {
    if (!searchQuery) return connections;
    const q = searchQuery.toLowerCase();
    return connections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.host.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [connections, searchQuery]);

  const handleEdit = (connection: ConnectionConfig) => {
    setEditingConnection(connection);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingConnection(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
            Connections
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {connections.length} saved connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Import dropdown */}
          <div className="relative" ref={importMenuRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowImportMenu(!showImportMenu)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:bg-[var(--color-surface-3)] hover:border-[var(--color-border-hover)] transition-all"
            >
              <FileDown size={15} />
              Import
              <ChevronDown size={13} />
            </motion.button>
            {showImportMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-0 top-12 z-50 w-52 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-2xl"
              >
                <button
                  onClick={() => {
                    setShowImportMenu(false);
                    addToast({ message: 'Use File > Open to import .rdp files', type: 'info' });
                  }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <FileDown size={14} />
                  Import .rdp file
                </button>
                <button
                  onClick={handleImportSshConfig}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <Terminal size={14} />
                  Import from SSH Config
                </button>
              </motion.div>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            New Connection
          </motion.button>
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex items-center gap-3 px-8 pb-5 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connections... (Cmd+K for quick connect)"
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/20 transition-all"
          />
        </div>
        <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 transition-colors ${
              viewMode === 'grid'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]'
            }`}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 transition-colors ${
              viewMode === 'list'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]'
            }`}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full"
            />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-64 text-center"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] mb-5">
              <Monitor size={28} className="text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1.5">
              {searchQuery ? 'No connections found' : 'No connections yet'}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-5 max-w-[280px]">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first remote desktop connection to get started'}
            </p>
            {!searchQuery && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
              >
                <Plus size={15} />
                Add Connection
              </motion.button>
            )}
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            layout
            className="grid gap-5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            }}
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((conn, i) => (
                <ConnectionCard
                  key={conn.id}
                  connection={conn}
                  index={i}
                  onEdit={handleEdit}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((conn, i) => (
                <ConnectionCard
                  key={conn.id}
                  connection={conn}
                  index={i}
                  onEdit={handleEdit}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Connection Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ConnectionForm
            connection={editingConnection}
            onClose={handleCloseForm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
