import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Monitor,
  FileDown,
  Terminal,
} from 'lucide-react';
import { useConnectionStore } from '../../stores/connectionStore';
import { useToastStore } from '../../stores/toastStore';
import { ConnectionCard } from './ConnectionCard';
import { ConnectionForm } from './ConnectionForm';
import type { ConnectionConfig } from '../../types';
import * as tauri from '../../lib/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleImportSshConfig = async () => {
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
      <div className="shrink-0 px-4 pb-4 pt-6 md:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Connections
          </h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            <Badge variant="secondary">{connections.length}</Badge>
            saved connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* Import dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <FileDown className="size-4" />
                Import
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  addToast({ message: 'Use File > Open to import .rdp files', type: 'info' });
                }}
              >
                <FileDown className="size-4" />
                Import .rdp file
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportSshConfig}>
                <Terminal className="size-4" />
                Import from SSH Config
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setShowForm(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            New Connection
          </Button>
        </div>
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pb-5 md:px-8 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-4"
          />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connections... (Cmd+K for quick connect)"
            className="pl-9"
          />
        </div>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => {
            if (value) setViewMode(value as 'grid' | 'list');
          }}
          variant="outline"
          className="self-end sm:self-auto"
        >
          <ToggleGroupItem value="grid" aria-label="Grid view">
            <LayoutGrid className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
            />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-64 text-center"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-5">
              <Monitor className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              {searchQuery ? 'No connections found' : 'No connections yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-[280px]">
              {searchQuery
                ? 'Try a different search term'
                : 'Add your first remote desktop connection to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="size-4" />
                Add Connection
              </Button>
            )}
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div
            layout
            className="grid gap-5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
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
