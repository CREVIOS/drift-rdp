import { useState } from 'react';
import { Zap, Check } from 'lucide-react';
import type { ConnectionConfig } from '../../types';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import * as tauri from '../../lib/tauri';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface Props {
  connection: ConnectionConfig | null;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4', '#f43f5e',
];

const RESOLUTIONS = [
  '1920x1080', '1600x900', '1366x768', '1280x720', '2560x1440', '3840x2160',
];

export function ConnectionForm({ connection, onClose }: Props) {
  const createConnection = useConnectionStore((s) => s.createConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);
  const defaultPort = useSettingsStore((s) => s.settings.defaultPort);
  const addToast = useToastStore((s) => s.addToast);

  const isEdit = !!connection;

  const [name, setName] = useState(connection?.name ?? '');
  const [host, setHost] = useState(connection?.host ?? '');
  const [port, setPort] = useState(connection?.port ?? defaultPort);
  const [username, setUsername] = useState(connection?.username ?? '');
  const [password, setPassword] = useState(connection?.password ?? '');
  const [domain, setDomain] = useState(connection?.domain ?? '');
  const [colorAccent, setColorAccent] = useState(connection?.colorAccent || PRESET_COLORS[0]);
  const [tagsInput, setTagsInput] = useState(connection?.tags.join(', ') ?? '');
  const [resolution, setResolution] = useState(
    connection ? `${connection.displayWidth ?? 1920}x${connection.displayHeight ?? 1080}` : '1920x1080'
  );
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!host.trim()) errs.host = 'Host is required';
    if (!port || port < 1 || port > 65535) errs.port = 'Invalid port';
    if (!username.trim()) errs.username = 'Username is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || isSubmitting) return;
    const parts = resolution.split('x').map(Number);
    let w = parts[0], h = parts[1];
    if (isNaN(w) || isNaN(h)) { w = 1920; h = 1080; }
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

    setIsSubmitting(true);
    try {
      if (isEdit && connection) {
        await updateConnection(connection.id, { name, host, port, username, password: password || undefined, domain, colorAccent, tags, displayWidth: w, displayHeight: h });
      } else {
        await createConnection({ name, host, port, username, password: password || undefined, domain, colorAccent, tags, displayWidth: w, displayHeight: h, lastConnectedAt: undefined });
      }
      addToast({ message: 'Connection saved', type: 'success' });
      onClose();
    } catch (e) {
      addToast({ message: e instanceof Error ? e.message : 'Failed to save', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!host || !port) return;
    setTestResult('testing');
    try {
      const ok = await tauri.testConnection(host, port);
      setTestResult(ok ? 'success' : 'fail');
    } catch { setTestResult('fail'); }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        {/* Accent strip */}
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: colorAccent }} />

        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the connection details below.' : 'Enter the details for your remote desktop connection.'}
          </DialogDescription>
        </DialogHeader>

        {/* Form body */}
        <div className="grid gap-5 py-2 max-h-[55vh] overflow-y-auto pr-1">
          {/* Connection Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">Connection Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Server" />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Host + Port */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="host">Host</Label>
              <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="192.168.1.100" maxLength={253} />
              {errors.host && <p className="text-xs text-destructive">{errors.host}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="port">Port</Label>
              <Input id="port" type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              {errors.port && <p className="text-xs text-destructive">{errors.port}</p>}
            </div>
          </div>

          {/* Username + Domain */}
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
              {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="WORKGROUP" />
            </div>
          </div>

          {/* Password */}
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>

          <Separator />

          {/* Accent Color */}
          <div className="grid gap-2">
            <Label>Accent Color</Label>
            <div className="flex items-center gap-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColorAccent(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110 flex items-center justify-center"
                  style={{
                    background: c,
                    borderColor: colorAccent === c ? 'white' : 'transparent',
                  }}
                >
                  {colorAccent === c && <Check className="size-3.5 text-white drop-shadow" />}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="production, web-server" />
          </div>

          {/* Resolution */}
          <div className="grid gap-2">
            <Label>Resolution</Label>
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between pt-1">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={!host || !port}>
            <Zap className="size-3.5" />
            {testResult === 'testing' ? 'Testing...' : testResult === 'success' ? 'Connected!' : testResult === 'fail' ? 'Failed' : 'Test Connection'}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Connection'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
