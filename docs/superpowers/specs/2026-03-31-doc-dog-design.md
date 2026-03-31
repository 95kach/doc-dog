# doc-dog — Design Spec

**Date:** 2026-03-31
**Status:** Approved

## Overview

`doc-dog` is a CLI tool that takes a directory of Markdown files and renders them as a website using Markdoc. It is designed as a lightweight competitor to Redocly Realm, with a clear extension path toward OpenAPI and other documentation formats.

Usage:
```bash
cd example/
npx @docdog/cli preview   # dev server with live reload
npx @docdog/cli build     # static HTML export to dist/
npx @docdog/cli deploy    # build + copy to cdn/ + simulated CDN server
```

---

## Architecture

**Approach: In-memory build on startup + incremental updates.**

All three commands share a single rendering pipeline:

```
Config Loader → File Discoverer → Route Builder → Markdoc Renderer → Page Cache
```

Commands diverge after the cache is warm:
- `preview` — starts Fastify dev server + chokidar watcher + SSE manager
- `build` — walks cache, writes HTML files to `dist/`
- `deploy` — calls build, copies `dist/` → `cdn/`, starts second static server on `CDN_PORT`

The rendering pipeline is a set of pure functions. The cache is the single source of truth for all served content.

---

## Project Structure

```
doc-dog/
├── src/
│   ├── cli.ts                    ← commander entry, registers 3 commands
│   ├── commands/
│   │   ├── preview.ts            ← warm cache → dev server + watcher
│   │   ├── build.ts              ← warm cache → write dist/
│   │   └── deploy.ts            ← build → copy cdn/ → static server
│   ├── core/
│   │   ├── config.ts             ← load .env + docdog.config.json, validate with zod
│   │   ├── discover.ts           ← walk docsDir, emit { filePath, route } pairs
│   │   ├── renderer.ts           ← Markdoc: .md → { html, frontmatter } or error
│   │   ├── cache.ts              ← PageCache: Map<route, PageResult> + NavTree
│   │   └── nav.ts                ← build NavTree from route map
│   ├── server/
│   │   ├── dev-server.ts         ← Fastify: GET /:route, GET /sse
│   │   ├── static-server.ts      ← Fastify: serve cdn/ on CDN_PORT
│   │   └── sse.ts                ← SSEManager: register clients, broadcast reload
│   └── templates/
│       └── layout.ts             ← HTML shell: navbar, sidebar, content slot, error pages
├── example/
│   ├── .env
│   ├── docdog.config.json
│   └── docs/
│       ├── index.md
│       └── operations/
│           └── create.md
└── package.json
```

---

## Key Data Types

```ts
type PageResult =
  | { ok: true;  route: string; filePath: string; html: string; frontmatter: Record<string, unknown> }
  | { ok: false; route: string; filePath: string; error: string }

type NavItem = { label: string; href: string; children: NavItem[] }

type Config = {
  name: string          // shown in top-left navbar
  docsDir: string       // relative to CWD, default: "./docs"
  sidebar: { auto: boolean }
}

type Runtime = {
  port: number          // default: 3000, auto-increments if taken
  cdnPort: number       // default: 3100
  cdnDir: string        // default: "../cdn"
}
```

---

## Configuration

### `docdog.config.json` (in CWD, content config)
```json
{
  "name": "Chop-Chop",
  "docsDir": "./docs",
  "sidebar": { "auto": true }
}
```

### `.env` (in CWD, runtime/infra config)
```
PORT=3000
CDN_PORT=3100
CDN_DIR=../cdn
```

Config is loaded and validated with zod at startup. Invalid config prints a clear error and exits.

---

## Routing

File paths map to URL routes by stripping the `docsDir` prefix and removing the `.md` extension. Casing is preserved — authors control URL shape via file naming:

| File | Route |
|---|---|
| `docs/index.md` | `/` |
| `docs/getting-started.md` | `/getting-started` |
| `docs/operations/create.md` | `/operations/create` |

Nested directories become URL path segments. The sidebar NavTree mirrors this hierarchy — folders become groups, files become links.

---

## Live Reload (preview mode)

1. Browser connects to `GET /sse` (persistent SSE connection, `text/event-stream`)
2. chokidar watches `docsDir` for `add`, `change`, `unlink` events
3. On change: re-render only the changed file → update cache entry → SSE broadcasts `data: {"type":"reload","route":"/operations/create"}`
4. Browser script receives event → calls `location.reload()`
5. SSE client script is injected into every page's HTML only in `preview` mode — stripped in `build`/`deploy` output

---

## Port Selection

On `preview` startup, attempt to bind `PORT`. If the port is taken, increment by 1 and retry up to 10 times. Print the actual bound port to stdout. Same logic applies to `CDN_PORT` for `deploy`.

---

## Page Layout

```
┌─────────────────────────────────────────┐
│  [name from config]          navbar     │
├──────────────┬──────────────────────────┤
│              │                          │
│   Sidebar    │   Markdoc content        │
│   (NavTree)  │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

- Navbar: project `name` top-left
- Sidebar: auto-generated from file tree, current page highlighted, folders as collapsible groups
- Live reload indicator injected bottom-right in preview mode only

---

## Error Handling

The cache stores `PageResult` as a discriminated union (`ok: true | false`). Partial failures never crash the server.

| Surface | Trigger | Response |
|---|---|---|
| **404** | Route not in cache | HTML page: "Page not found", requested path, ← Back to home |
| **500** | Markdoc render throws | HTML page: error message from exception, ← Back to home |
| **CDN empty** | `cdn/` missing or empty when static server starts | HTML page: "Nothing deployed yet" with `deploy` command instructions |
| **Partial build failure** | One or more `.md` files fail during startup | Server starts with remaining pages. Failed routes return 500 with parse error inline. All failures printed to terminal at startup. |

---

## Deploy Simulation

`deploy` command:
1. Runs full build pipeline → `dist/`
2. Prints `Deploying...` with progress logs
3. Copies `dist/` → `cdn/` (creates dir if missing)
4. Starts a static Fastify server on `CDN_PORT` serving `cdn/`
5. Prints `Deployed at http://localhost:CDN_PORT`

`preview` and `deploy` run as separate processes on different ports — no conflict.

---

## Testing

**Framework:** vitest

**Unit tests** (pure functions, no I/O):
- `discover.ts` — route mapping correctness, nested paths, `index.md` → `/`
- `renderer.ts` — valid `.md` returns `{ ok: true, html }`, parse error returns `{ ok: false, error }`
- `nav.ts` — flat route list → correct NavTree nesting
- `config.ts` — zod rejects missing `name`, bad port types, unknown fields

**Integration tests** (real files, no network):
- Full pipeline: temp dir with `.md` files → `buildCache()` → assert routes and HTML
- Build command: temp dir → `build()` → assert `dist/` file tree matches routes
- 404/500: cache with failed entry → assert correct HTML and status code returned

**Server tests** (Fastify `inject()`, no real port):
- `GET /` returns 200 with page HTML
- `GET /nonexistent` returns 404 HTML
- `GET /sse` returns `text/event-stream` content-type
- Page with render error returns 500 HTML with error message

---

## Extension Points

The rendering pipeline is designed to accept non-Markdown sources in the future:
- `discover.ts` can be extended to emit `.yaml`/`.json` files (OpenAPI specs)
- `renderer.ts` is a pure `(filePath) => PageResult` function — an OpenAPI renderer would implement the same interface
- `cache.ts` and the server layer are format-agnostic

---

## Known Shortcuts (prototype)

- No search functionality
- Sidebar is always auto-generated (no manual ordering config)
- No syntax highlighting for code blocks (can add `shiki` later)
- No broken link detection (planned, not implemented)
- Deploy simulation only — no real CDN upload
