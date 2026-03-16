# TODOS

## Completed

### ~~IronRDP Integration~~ ✓
Actor-per-session pattern implemented. IronRDP crates added (v0.14). TCP connection + TLS infrastructure built. Falls back to mock frames until connected to a live Windows server. Full protocol negotiation code is structured and ready to enable.

### ~~Auto-Reconnect with Exponential Backoff~~ ✓
Implemented with delays of 2s, 4s, 8s, 16s, 30s (capped). Max 5 attempts. Reconnecting overlay shows attempt count and estimated delay. Cancel button available. Triggered on connection loss (not user disconnect).

### ~~Clipboard Sync Scaffold~~ ✓
Backend commands (clipboard_write, clipboard_read) and frontend hook (useClipboard) scaffolded. Ready to wire to IronRDP's cliprdr virtual channel.

### ~~Connection State Animations~~ ✓
Pulsing indigo glow on testing, green pulse on success, shake on error. Connecting spinner overlay on Connect button click.

### ~~SSH Config Import~~ ✓
Parses ~/.ssh/config Host entries. Creates connections with RDP port 3389. Available in Import dropdown on ConnectionGrid.

---

## Remaining

### P1 — Enable Full IronRDP Protocol Negotiation
**What:** Enable the commented-out IronRDP connector code to complete TLS + CredSSP/NLA handshake with real Windows servers.
**Why:** The TCP connection and TLS infrastructure are in place, but the full RDP protocol negotiation (X.224, MCS, licensing, capabilities exchange) needs a live Windows server to test against.
**Effort:** M
**Context:** See `rdp/client.rs::attempt_rdp_connection()`. The IronRDP connector config, TLS upgrade, and session loop are structured. Need to: (1) test against a Windows VM with RDP enabled, (2) handle the various NLA scenarios, (3) wire IronRDP's graphics updates into the frame emitter.
**Depends on:** Access to a Windows machine with RDP enabled for testing.

### P2 — Wire Clipboard to IronRDP cliprdr Channel
**What:** Connect the clipboard scaffold to IronRDP's `ironrdp-cliprdr` virtual channel.
**Why:** The frontend hook and backend commands exist but return stubs. Need real clipboard sync.
**Effort:** M
**Context:** `useClipboard.ts` listens for paste events and Tauri clipboard events. `commands/clipboard.rs` has stub commands. IronRDP's cliprdr SVC needs to be registered with the session and bridged to these commands.
**Depends on:** Full IronRDP protocol negotiation (P1).

### P2 — Audio Redirection
**What:** Forward remote audio to local speakers via IronRDP's rdpsnd channel.
**Why:** Many remote desktop workflows involve audio (video calls, media).
**Effort:** L
**Context:** `ironrdp-rdpsnd` and `ironrdp-rdpsnd-native` crates are available. Need to register the SVC, decode audio samples, and play locally (via `cpal` or `rodio` crate).
**Depends on:** Full IronRDP protocol negotiation (P1).

### P3 — File Transfer via Drag-and-Drop
**What:** Drag files from local OS onto the session canvas to transfer to remote machine.
**Why:** File transfer is a core RDP workflow.
**Effort:** L
**Context:** Use `ironrdp-rdpdr` (device redirection) to expose a virtual drive. Frontend handles drag events.
**Depends on:** Full IronRDP protocol negotiation (P1).

### P3 — SSH Tunneling
**What:** Built-in SSH tunnel for RDP-over-SSH connections.
**Effort:** M
**Context:** The `ssh2` crate was in the original plan. Create a local TCP proxy that tunnels through an SSH connection to the target host's RDP port.
