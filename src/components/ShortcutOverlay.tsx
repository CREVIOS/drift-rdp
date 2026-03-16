import { Command } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <Badge
      variant="outline"
      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md text-[11px] font-medium shadow-[0_1px_0_1px_var(--color-surface-0)]"
    >
      {isSymbol ? <Command size={11} /> : children}
    </Badge>
  );
}

export function ShortcutOverlay({ onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate faster with keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        {/* Sections */}
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-5">
            {sections.map((section, sectionIndex) => (
              <div key={section.title}>
                {sectionIndex > 0 && <Separator className="mb-5" />}
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-xs text-muted-foreground">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
