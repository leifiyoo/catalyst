# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Catalyst is a desktop Minecraft server manager built with Electron + Vite + React + TypeScript. It manages server creation, lifecycle (start/stop/restart), console output, server properties, backups, Modrinth plugin/mod integration, ngrok tunneling, and import/export.

## Commands

- `npm run dev` — Start Electron app in development mode (HMR enabled)
- `npm run build` — Typecheck then build for production
- `npm run build:win` / `build:mac` / `build:linux` — Build platform-specific installers
- `npm run typecheck` — Run TypeScript checks for both main and renderer
- `npm run test:unit` — Run tests with Vitest (no separate config file; configured in package.json)
- `npm run start` — Preview the built app via `electron-vite preview`

## Architecture

### Three-process Electron structure

```
src/main/          — Main (Node.js) process
src/preload/       — Preload bridge (contextBridge)
src/renderer/src/  — Renderer (React) UI
src/shared/        — Shared types used by all processes
```

All IPC between renderer and main goes through `src/preload/index.ts`, which exposes `window.context.*` methods. The renderer calls `window.context.someMethod(...)`, the preload maps it to `ipcRenderer.invoke("someMethod", ...)`, and `src/main/index.ts` registers `ipcMain.handle("someMethod", ...)` handlers.

### Main process modules (`src/main/lib/`)

- `server-manager.ts` — CRUD for server records (JSON-based), file operations, properties, whitelist/banlist, import/export
- `server-runner.ts` — Spawns Java child processes, manages console output streaming, server status, restart logic
- `backup-manager.ts` — Manual and automatic backup creation/restore using a worker thread
- `backup-worker.ts` — Worker thread for backup operations
- `modrinth.ts` — Modrinth API integration for searching/installing/updating plugins and mods
- `ngrok-manager.ts` — ngrok tunnel management for exposing servers publicly
- `java-manager.ts` — Java runtime detection and management
- `update-checker.ts` — App update checking against GitHub releases

### Renderer (`src/renderer/src/`)

- **Routing**: Hash router in `App.tsx` with routes: `/` (Dashboard), `/servers`, `/servers/:id`, `/settings`
- **Layout**: `DashboardLayout.tsx` wraps all routes with a sidebar (`AppSidebar`) and title bar
- **Pages**: `DashboardPage`, `ServersPage`, `ServerDetailPage` (~2000 lines, handles all server management tabs), `SettingsPage`
- **Components**: shadcn/ui components in `components/ui/`, custom components alongside

### Styling

- **Tailwind CSS 3** with shadcn/ui conventions (HSL CSS variables)
- **Theme**: `src/renderer/src/assets/theme.css` defines CSS custom properties (dark palette with green primary `hsl(142, 35%, 45%)`)
- **Base styles**: `src/renderer/src/assets/index.css` — custom fonts (Outfit, Google Sans Code), scrollbar styling, layout classes
- **Dark mode**: Uses `class` strategy in Tailwind config; `DashboardLayout` applies `dark` class
- Colors reference semantic tokens: `bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, etc.

### Path aliases (configured in `electron.vite.config.ts` and tsconfig files)

- `@renderer/*` → `src/renderer/src/*`
- `@/components/*`, `@/pages/*`, `@/layouts/*`, `@/hooks/*`, `@/utils/*`, `@/assets/*` → `src/renderer/src/...`
- `@shared/*` → `src/shared/*`
- `@/lib/*` → `src/main/lib/*` (main process only)

### Key dependencies

- **UI**: React 19, shadcn/ui (Radix UI primitives), Tailwind CSS, Motion (animation), Lucide icons
- **Build**: electron-vite, electron-builder (NSIS installer on Windows)
- **Server I/O**: adm-zip, archiver (for backup/export)

### Custom window frame

The app uses `frame: false` (frameless window) with a custom `TitleBar` component providing minimize/maximize/close controls. The window starts at 900x670, then maximizes after the splash screen.

## Notes

- `ServerDetailPage.tsx` is very large (~2000 lines). Use targeted edits rather than full rewrites.
- Server data is stored as JSON files in the user's app data directory, not a database.
- The app uses `contextIsolation: true` and `sandbox: true` — all main process access must go through the preload bridge.
- `__APP_VERSION__` is injected at build time from `package.json` version.
