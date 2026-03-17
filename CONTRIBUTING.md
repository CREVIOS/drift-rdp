# Contributing to Drift

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/CREVIOS/drift-rdp.git
cd drift-rdp
npm install
cargo tauri dev
```

### Prerequisites

- Rust 1.77+
- Node.js 20+
- Tauri CLI (`cargo install tauri-cli`)
- macOS: `xcode-select --install`
- Linux: `sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`

## Workflow

1. **Fork** the repo and create a branch from `master`
2. **Name your branch** descriptively: `feat/clipboard-sync`, `fix/scroll-direction`, `docs/architecture`
3. **Make your changes** — keep PRs focused and small
4. **Test locally:**
   ```bash
   cargo check            # Rust compilation
   cargo test             # Rust tests
   npx tsc --noEmit       # TypeScript types
   npx vitest run         # Frontend tests
   cargo fmt --check      # Rust formatting
   cargo clippy           # Rust lints
   ```
5. **Open a PR** against `master` — fill out the template
6. CI must pass before merge (squash-merge only)

## Code Style

### Rust
- `cargo fmt` for formatting
- `cargo clippy -- -D warnings` for lints
- Prefer `Result<T, E>` over `unwrap()`/`expect()` in production paths
- Use `log::info!`/`log::warn!`/`log::error!` for observability
- Document public APIs with `///` doc comments

### TypeScript
- Strict mode (`noEmit` check must pass)
- Use shadcn/ui components from `@/components/ui/`
- Use `cn()` from `@/lib/utils` for conditional classes
- Hooks go in `src/hooks/`, stores in `src/stores/`

### Commits
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`
- Keep messages concise — the PR description has the details
- All PRs are squash-merged

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for system design and data flow diagrams.

Key principles:
- **Actor-per-session** — each RDP connection runs in its own tokio task
- **SharedFrame** — zero-copy double-buffer between session actor and GPU renderer
- **Fallback paths** — GPU rendering falls back to webview Canvas if wgpu unavailable
- **No panics in production** — use `Result<>` for anything that can fail

## Getting Help

- Open an [issue](https://github.com/CREVIOS/drift-rdp/issues) for bugs or questions
- Start a [discussion](https://github.com/CREVIOS/drift-rdp/discussions) for ideas
