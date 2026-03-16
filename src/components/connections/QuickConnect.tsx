import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, ArrowRight } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useConnectionStore } from '../../stores/connectionStore';
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';

export function QuickConnect() {
  const navigate = useNavigate();
  const show = useSessionStore((s) => s.showQuickConnect);
  const setShow = useSessionStore((s) => s.setShowQuickConnect);
  const connections = useConnectionStore((s) => s.connections);

  const handleConnect = useCallback(
    (connectionId: string) => {
      setShow(false);
      navigate(`/session/${connectionId}`);
    },
    [navigate, setShow]
  );

  // Reset on open handled by CommandDialog mounting fresh

  return (
    <CommandDialog
      open={show}
      onOpenChange={setShow}
      title="Quick Connect"
      description="Search connections or enter hostname"
    >
      <Command
        filter={(value, search) => {
          const conn = connections.find((c) => c.id === value);
          if (!conn) return 0;
          const haystack = `${conn.name} ${conn.host}`.toLowerCase();
          return haystack.includes(search.toLowerCase()) ? 1 : 0;
        }}
      >
        <CommandInput placeholder="Search connections or enter hostname..." />
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Monitor className="size-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">
                No connections match your search
              </p>
            </div>
          </CommandEmpty>
          <CommandGroup heading="Connections">
            {connections.map((conn) => (
              <CommandItem
                key={conn.id}
                value={conn.id}
                onSelect={() => handleConnect(conn.id)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: (conn.colorAccent || '#6366f1') + '22' }}
                  >
                    <Monitor className="size-3.5" style={{ color: conn.colorAccent || '#6366f1' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {conn.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {conn.host}:{conn.port}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-[10px] font-medium">Connect</span>
                  <ArrowRight className="size-3" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
        {/* Footer hints */}
        <div className="flex items-center gap-4 px-3 py-2 border-t text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">&#x2191;&#x2193;</kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">&#x23ce;</kbd>
            Connect
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd>
            Close
          </span>
        </div>
      </Command>
    </CommandDialog>
  );
}
