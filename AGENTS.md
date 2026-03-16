# AGENTS.md — ClawWork Agent Guide

ClawWork is a dedicated desktop client for [OpenClaw](https://github.com/openclaw/openclaw) — a three-panel Electron app with parallel multi-task AI sessions, structured progress tracking, and local-first artifact persistence backed by Git.

## Directory Structure

```
./
├── packages/
│   ├── shared/               # @clawwork/shared — zero-dependency types, protocol, constants
│   │   └── src/              # types.ts, protocol.ts, gateway-protocol.ts, constants.ts, debug.ts
│   └── desktop/              # @clawwork/desktop — Electron app
│       └── src/
│           ├── main/         # Main process: ws/, ipc/, db/, artifact/, workspace/, debug/
│           ├── preload/      # contextBridge — exposes ClawWorkAPI to renderer
│           └── renderer/     # React UI: components/, layouts/, stores/, hooks/, i18n/, styles/
├── docs/                     # Design documents and specs
├── CLAUDE.md                 # AI coding assistant guide (detailed)
├── DEVELOPMENT.md            # Dev setup, packaging, debug observability
└── CONTRIBUTING.md           # PR conventions and contribution guidelines
```

### Key Renderer Subdirectories

| Path | Contents |
|------|----------|
| `renderer/stores/` | Zustand stores: `taskStore`, `messageStore`, `uiStore`, `fileStore`, `approvalStore` |
| `renderer/components/` | General-purpose components (chat, file cards, tool calls, etc.) |
| `renderer/layouts/` | Layout panels: `LeftNav/`, `MainArea/`, `RightPanel/`, `FileBrowser/`, `Settings/`, `Setup/` |
| `renderer/hooks/` | Custom React hooks |
| `renderer/i18n/` | Internationalization resources |
| `renderer/styles/` | Global CSS and Tailwind configuration |

## Build and Test Commands

```bash
# Install dependencies
pnpm install

# Start development (Electron hot-reload)
pnpm dev

# Type-check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run all tests
pnpm test

# Package (macOS arm64)
pnpm --filter @clawwork/desktop build:mac:arm64

# Package (macOS x64)
pnpm --filter @clawwork/desktop build:mac:x64

# Package (macOS Universal Binary)
pnpm --filter @clawwork/desktop build:mac:universal

# Package (Windows)
pnpm --filter @clawwork/desktop build:win
```

Requirements: Node.js >= 20, pnpm >= 9.

## Code Style and Conventions

### TypeScript
- Strict mode is enforced; `any` is **not** allowed
- All shared types live in `@clawwork/shared`; import from there in `@clawwork/desktop`
- `@clawwork/shared` has `composite: true`; desktop references it via TypeScript `references`

### Styling
- Tailwind CSS v4 utility classes
- **All** colors must use CSS Variables (`var(--xxx)`) — no hardcoded hex values
- Theme toggled via `<html data-theme="dark|light">`; dark is the default
- Core accent: green `#0FFD0D` (dark) / `#0B8A0A` (light); background `#1C1C1C` / `#FAFAFA`

### State Management
- Zustand 5, one store per domain
- Do not add cross-store dependencies; keep stores focused

### Components
- Layout-level components go in `renderer/layouts/<Panel>/`
- Reusable UI components go in `renderer/components/`
- Use `shadcn/ui` primitives (Radix UI + cva + tailwind-merge) for new interactive elements

### IPC / Protocol
- IPC channels are declared in `packages/desktop/src/preload/`; keep the surface minimal
- WebSocket RPC and event types are defined in `@clawwork/shared/src/gateway-protocol.ts`
- Session key format: `agent:main:clawwork:task:<taskId>`
- Always set `deliver: false` on `chat.send` to prevent external channel delivery

## PR and Commit Conventions

Use one of the following title prefixes:

| Prefix | When to use |
|--------|-------------|
| `[Feat]` | New user-visible capability |
| `[Fix]` | Bug fix |
| `[UI]` | Renderer or UX change |
| `[Docs]` | Documentation-only change |
| `[Refactor]` | Internal cleanup with no intended behavior change |
| `[Build]` | CI, packaging, dependencies, or tooling |
| `[Chore]` | Maintenance work |

Every PR must include:
- A clear summary of what changed and why
- Linked issues when applicable
- The verification steps actually run
- Screenshots or recordings for visible UI changes
- A release note for user-facing changes (or `NONE` if internal)

## Security Guidelines

- **Never** commit secrets, API keys, tokens, or passwords to the repository
- **Never** hardcode credentials; use environment variables or user-supplied config
- **Never** hardcode hex color values — use CSS Variables so the theme system works correctly
- Respect the `mediaLocalRoots` security check on file transfers (v2026.3.2+)
- Keep the Electron `contextBridge` surface minimal; validate all IPC input in the main process
- Do not disable `contextIsolation` or `nodeIntegration` in renderer windows
