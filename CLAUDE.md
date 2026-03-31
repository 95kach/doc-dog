# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test              # Run all tests (vitest)
npx vitest run tests/core/config.test.ts  # Run a single test file
npm run build         # Compile TypeScript to dist/

# From example/ directory:
npx tsx ../src/cli.ts preview   # Dev server with live reload
npx tsx ../src/cli.ts build     # Static HTML to example/dist/
npx tsx ../src/cli.ts deploy    # Build + copy to cdn/ + CDN server
```

## Architecture

**Rendering pipeline** (shared by all three commands):
```
loadConfig → discoverFiles → PageCache.build → [preview|build|deploy]
```

**Key types** (`src/types.ts`):
- `PageResult` — discriminated union `{ ok: true, html }` or `{ ok: false, error }`. Partial failures never crash the server.
- `PageCache` — in-memory store: `Map<route, PageResult>` + `navTree: NavItem[]`. Single source of truth for all served content.
- `Config` — site settings from `docdog.config.json` (name, docsDir)
- `Runtime` — infra settings from `.env` (PORT, LOCAL_CDN_PORT, LOCAL_CDN_DIR)

**Module responsibilities:**
- `src/core/` — pure functions: config loading, file discovery, Markdoc rendering, NavTree building, PageCache
- `src/server/` — Fastify servers: dev server (routes + SSE), static CDN server, SSE manager
- `src/templates/` — HTML generation: full page layout, 404, CDN empty page
- `src/commands/` — command orchestration: preview (server + watcher), build (writes dist/), deploy (build + copy + static server)
- `src/cli.ts` — commander entry point

**Live reload flow:** Browser `EventSource('/sse')` → chokidar file change → `cache.update()` → `SSEManager.broadcast()` → `location.reload()`

**Routing:** `docs/operations/create.md` → `/operations/create`. `docs/index.md` → `/`. Casing preserved from filenames.

**Config split:**
- `docdog.config.json` (in CWD) — site content config: `name`, `docsDir`
- `.env` (in CWD) — runtime infra: `PORT`, `LOCAL_CDN_PORT`, `LOCAL_CDN_DIR`

## Example project

`example/` contains a working Chop-Chop API docs site. Run commands from inside `example/`.

## ESM + TypeScript

All imports use `.js` extension (NodeNext module resolution). TypeScript source in `src/`, compiled to `dist/`.
