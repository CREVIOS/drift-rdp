# Architecture

## Current Architecture (Phase 1 — Stub)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TAURI PROCESS                                 │
│                                                                      │
│  ┌──── WebView (React) ──────────────────────────────────────────┐  │
│  │  App.tsx                                                       │  │
│  │  ├── ErrorBoundary                                             │  │
│  │  ├── Titlebar (custom frameless)                               │  │
│  │  ├── Sidebar (collapsible nav)                                 │  │
│  │  ├── Routes                                                    │  │
│  │  │   ├── / → ConnectionGrid → ConnectionCard[]                 │  │
│  │  │   ├── /session/:connectionId → SessionView                  │  │
│  │  │   │   ├── SessionCanvas (HTML5 Canvas, keyboard/mouse)      │  │
│  │  │   │   ├── SessionToolbar (auto-hide)                        │  │
│  │  │   │   ├── SessionTabs (multi-session)                       │  │
│  │  │   │   └── PerformanceHUD                                    │  │
│  │  │   └── /settings → SettingsPage                              │  │
│  │  ├── QuickConnect (Cmd+K)                                      │  │
│  │  ├── ShortcutOverlay (Cmd+?)                                   │  │
│  │  ├── ToastContainer                                            │  │
│  │  └── StatusBar                                                 │  │
│  │                                                                │  │
│  │  Stores: connectionStore, sessionStore, settingsStore, toast   │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│         Tauri IPC (invoke)    │    Tauri Events (frame-{sid})        │
│                               ▼                            ▲         │
│  ┌──── Rust Backend ───────────────────────────────────────┼──────┐  │
│  │  commands/ (CRUD, session, settings, latency)           │      │  │
│  │  store/ (connections.json, settings.json, OS keychain)  │      │  │
│  │  rdp/ (stub client, mock frame generator ──────────────►┘      │  │
│  │  utils/ (TCP probe, latency measurement)                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Target Architecture (Phase 2 — IronRDP)

When integrating IronRDP, the session management should migrate from the current
shared-mutex pattern to an **actor-per-session** pattern:

```
                  SessionManager
                  (lightweight registry)
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    SessionHandle  SessionHandle  SessionHandle
    ├── cmd_tx     ├── cmd_tx     ├── cmd_tx
    │  (mpsc)      │  (mpsc)      │  (mpsc)
    ▼              ▼              ▼
    SessionActor   SessionActor   SessionActor
    ├── IronRDP    ├── IronRDP    ├── IronRDP
    │   Session    │   Session    │   Session
    ├── FrameBuf   ├── FrameBuf   ├── FrameBuf
    ├── State      ├── State      ├── State
    └── AppHandle  └── AppHandle  └── AppHandle
        (for emit)     (for emit)     (for emit)
```

### Why actors over shared mutex?

1. **No lock contention**: Each session owns its state. Frame emission doesn't
   block input forwarding on another session.
2. **Clean lifecycle**: Dropping the SessionHandle kills the actor task.
3. **Backpressure**: The mpsc channel naturally handles command queuing.
4. **IronRDP compatibility**: IronRDP's async session loop runs as a long-lived
   task — it maps directly to the actor pattern.

### SessionHandle API

```rust
struct SessionHandle {
    id: String,
    cmd_tx: mpsc::Sender<SessionCommand>,
    info: watch::Receiver<SessionInfo>,
}

enum SessionCommand {
    SendKey { key_code: u32, is_down: bool },
    SendMouse { x: i32, y: i32, button: Option<String>, event_type: String },
    Resize { width: u32, height: u32 },
    Disconnect,
}
```

### Frame Delivery

IronRDP delivers frames via callback. The actor encodes frames as PNG and emits
them via `app_handle.emit(&format!("frame-{}", id), base64_data)`. The frontend
listens with `listen<string>('frame-{sid}', ...)` — this pattern is already in
place.

## Session State Machine

```
                    ┌──────────────┐
                    │ Disconnected │ ◄──── initial
                    └──────┬───────┘
                           │ connect()
                           ▼
                    ┌──────────────┐
              ┌────►│  Connecting  │────────┐
              │     └──────┬───────┘        │ 30s timeout
              │            │ success        ▼
              │            ▼          ┌───────────┐
              │     ┌──────────────┐  │ Error(msg) │
              │     │  Connected   │  └─────┬─────┘
              │     └──────┬───────┘        │ auto_reconnect
              │            │ network drop   ▼
              │            ▼          ┌──────────────┐
              │     ┌──────────────┐  │ Reconnecting │ (backoff: 1,2,4,8...30s)
              │     │ Disconnected │  └──────┬───────┘
              │     └──────────────┘         │ success → Connected
              │                              │ max retries → Error
              └──────────────────────────────┘
```

## Key Design Decisions

1. **Event-driven frames** over polling — Rust pushes frames via Tauri events
2. **OS keychain** for credentials — keyring crate, not plaintext
3. **tokio::fs** for persistence — non-blocking I/O in async context
4. **PNG compression** for frame encoding — ~100x smaller than raw BMP
5. **SessionView owns session lifecycle** — no double-connect race conditions
6. **Max 10 sessions** with 30s connect timeout — bounded resources
7. **8K resolution cap** on resize — prevents OOM from malformed input
