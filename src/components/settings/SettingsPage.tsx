import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, MonitorCog } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const RESOLUTIONS = [
  '1920x1080',
  '1600x900',
  '1366x768',
  '1280x720',
  '2560x1440',
  '3840x2160',
];

export function SettingsPage() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground mb-1">
              Settings
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure your preferences
            </p>
          </div>

          {/* General */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                General
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Theme</Label>
                  <p className="text-[11px] text-muted-foreground">Choose your preferred color scheme</p>
                </div>
                <ToggleGroup
                  type="single"
                  value={theme}
                  onValueChange={(value) => {
                    if (value) setTheme(value as 'system' | 'light' | 'dark');
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="system" aria-label="System theme">
                    <MonitorCog className="size-3" />
                    <span className="text-xs capitalize">system</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="light" aria-label="Light theme">
                    <Sun className="size-3" />
                    <span className="text-xs capitalize">light</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark" aria-label="Dark theme">
                    <Moon className="size-3" />
                    <span className="text-xs capitalize">dark</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Separator />

              {/* Default Port */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Default Port</Label>
                  <p className="text-[11px] text-muted-foreground">Default RDP port for new connections</p>
                </div>
                <Input
                  type="number"
                  value={settings.defaultPort}
                  onChange={(e) =>
                    updateSettings({ defaultPort: Number(e.target.value) })
                  }
                  className="w-24"
                />
              </div>
            </CardContent>
          </Card>

          {/* Display */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Display
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Default Resolution */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Default Resolution</Label>
                  <p className="text-[11px] text-muted-foreground">Resolution for new connections</p>
                </div>
                <Select
                  value={settings.defaultResolution}
                  onValueChange={(value) =>
                    updateSettings({ defaultResolution: value })
                  }
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Color Depth */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Color Depth</Label>
                  <p className="text-[11px] text-muted-foreground">Bits per pixel</p>
                </div>
                <Select
                  value={String(settings.colorDepth)}
                  onValueChange={(value) =>
                    updateSettings({ colorDepth: Number(value) })
                  }
                >
                  <SelectTrigger className="w-[110px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16">16-bit</SelectItem>
                    <SelectItem value="24">24-bit</SelectItem>
                    <SelectItem value="32">32-bit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Quality */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Quality</Label>
                  <p className="text-[11px] text-muted-foreground">Image quality: {settings.quality}%</p>
                </div>
                <Slider
                  min={10}
                  max={100}
                  step={5}
                  value={[settings.quality]}
                  onValueChange={([value]) =>
                    updateSettings({ quality: value })
                  }
                  className="w-32"
                />
              </div>
            </CardContent>
          </Card>

          {/* Network */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Network
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Auto-reconnect */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-reconnect</Label>
                  <p className="text-[11px] text-muted-foreground">Automatically reconnect on connection loss</p>
                </div>
                <Switch
                  checked={settings.autoReconnect}
                  onCheckedChange={(checked) =>
                    updateSettings({ autoReconnect: checked })
                  }
                />
              </div>

              <Separator />

              {/* Reconnect Timeout */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Reconnect Timeout</Label>
                  <p className="text-[11px] text-muted-foreground">Wait time before reconnection attempt</p>
                </div>
                <Select
                  value={String(settings.reconnectTimeout)}
                  onValueChange={(value) =>
                    updateSettings({ reconnectTimeout: Number(value) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3000">3 seconds</SelectItem>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                    <SelectItem value="30000">30 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Connection Timeout */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Connection Timeout</Label>
                  <p className="text-[11px] text-muted-foreground">Max wait time for initial connection</p>
                </div>
                <Select
                  value={String(settings.connectionTimeout)}
                  onValueChange={(value) =>
                    updateSettings({ connectionTimeout: Number(value) })
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5000">5 seconds</SelectItem>
                    <SelectItem value="10000">10 seconds</SelectItem>
                    <SelectItem value="30000">30 seconds</SelectItem>
                    <SelectItem value="60000">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                About
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
                    <rect width="32" height="32" rx="8" fill="url(#drift-about)" />
                    <path d="M9 16C9 12.134 12.134 9 16 9C19.866 9 23 12.134 23 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                    <path d="M11 16C11 13.239 13.239 11 16 11C18.761 11 21 13.239 21 16" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
                    <circle cx="16" cy="16" r="2.5" fill="white" />
                    <path d="M16 18.5V24" stroke="white" strokeWidth="2" strokeLinecap="round" />
                    <path d="M13 22L16 24L19 22" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                    <defs>
                      <linearGradient id="drift-about" x1="0" y1="0" x2="32" y2="32">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">
                    Drift
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Version 0.1.0
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    A beautiful, high-performance remote desktop client.
                    Built with Tauri, React, and IronRDP.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
