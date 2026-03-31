# doc-dog

A CLI tool that turns a directory of Markdown files into a documentation website using [Markdoc](https://markdoc.dev). Lightweight alternative to Redocly Realm.

## Usage

Run from inside a project directory that contains `docdog.config.json`:

```bash
npx @docdog/cli preview   # dev server with live reload
npx @docdog/cli build     # static HTML export → dist/
npx @docdog/cli deploy    # build + copy to cdn/ + local CDN server
```

## Configuration

**`docdog.config.json`** — content config, lives next to your docs:

```json
{
  "name": "My Project",
  "docsDir": "./docs",
  "logo": {
    "image": "./images/logo.svg"
  }
}
```

**`.env`** — runtime/infra config:

```
PORT=3000
LOCAL_CDN_PORT=3100
LOCAL_CDN_DIR=../cdn
```

### Sidebar (`docs/sidebars.yaml`)

Define page labels and sidebar order. Without this file the sidebar is auto-generated from the file tree.

```yaml
- page: index.md
  label: Start here
- page: jobs/index.md
  label: Jobs
- page: "jobs/[:id]/index.md"
  label: Job Status
```

### Theming

All styles are defined as CSS custom properties. Override any of them in your own stylesheet:

```css
:root {
  --bg:              #fff;
  --bg-sidebar:      #f8fafc;
  --bg-code:         #f1f5f9;
  --bg-pre:          #f8fafc;
  --text:            #1e293b;
  --text-heading:    #0f172a;
  --text-body:       #374151;
  --text-muted:      #64748b;
  --text-sidebar:    #475569;
  --border:          #e2e8f0;
  --accent:          #2563eb;
  --accent-bg:       #eff6ff;
  --sidebar-width:   240px;
  --content-max-width: 860px;
  --font:            system-ui, sans-serif;
  --radius:          4px;
}
```

## File → Route Mapping

| File | Route |
|---|---|
| `docs/index.md` | `/` |
| `docs/guide.md` | `/guide` |
| `docs/jobs/index.md` | `/jobs` |
| `docs/jobs/[:id]/index.md` | `/jobs/[:id]` |

## Architecture

```
CWD (docdog.config.json + .env)
         │
         ▼
   ┌─────────────┐
   │   Config    │  name, docsDir, logo, port, cdnPort, cdnDir
   │   Loader    │
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐       ┌────────────────────────────────┐
   │    File     │──────▶│  Route Builder                 │
   │  Discoverer │       │  docs/jobs/index.md → /jobs    │
   └─────────────┘       └───────────────┬────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────┐
                         │  Markdoc Renderer              │
                         │  .md → HTML + frontmatter      │
                         └───────────────┬────────────────┘
                                         │
                                         ▼
                         ┌────────────────────────────────┐
                         │  Page Cache                    │
                         │  Map<route, PageResult>        │
                         │  + NavTree (from sidebars.yaml │
                         │    or auto-generated)          │
                         └───────┬────────────────┬───────┘
                                 │                │
             ┌───────────────────▼──┐    ┌────────▼──────────────────┐
             │  preview command     │    │  build / deploy command   │
             └───────────────────┬──┘    └────────┬──────────────────┘
                                 │                │
      ┌──────────────────────────┤         ┌──────▼─────────┐
      │                          │         │  HTML Writer   │
      ▼                          ▼         │  dist/ folder  │
┌──────────┐          ┌──────────────────┐ └──────┬─────────┘
│  Fastify │          │  File Watcher    │        │ deploy only
│  :PORT   │          │  (chokidar)      │        ▼
└────┬─────┘          └────────┬─────────┘ ┌──────────────────┐
     │                         │           │  cdn/ folder     │
     │            re-render +  │           │  Static Server   │
     │            cache update ◀───────────┘  :CDN_PORT       │
     ▼                         │           └──────────────────┘
┌──────────┐                   │ SSE broadcast
│  Browser │◀──────────────────┘  { type: 'reload' }
│  :PORT   │
└──────────┘
```

### Source layout

```
src/
├── cli.ts                  ← commander entry point (preview, build, deploy)
├── types.ts                ← shared types: PageResult, NavItem, Config, Runtime
├── core/
│   ├── config.ts           ← load docdog.config.json + .env, validate with zod
│   ├── discover.ts         ← walk docsDir → [{ filePath, route }]
│   ├── renderer.ts         ← Markdoc: .md → { ok, html } | { ok: false, error }
│   ├── nav.ts              ← routes + sidebars.yaml → NavItem[]
│   ├── sidebar.ts          ← load and parse sidebars.yaml
│   ├── cache.ts            ← PageCache: Map<route, PageResult> + navTree
│   └── minify.ts           ← HTML minification + size formatting
├── server/
│   ├── dev-server.ts       ← Fastify: pages, /style.css, /__logo.*, /sse
│   ├── static-server.ts    ← Fastify: serve cdn/ on CDN_PORT
│   └── sse.ts              ← SSEManager: register clients, broadcast reload
├── commands/
│   ├── preview.ts          ← warm cache → dev server + chokidar watcher
│   ├── build.ts            ← warm cache → write + minify dist/
│   └── deploy.ts           ← build → copy cdn/ → static server
└── templates/
    ├── layout.ts           ← HTML shell: navbar, sidebar, content, error pages
    └── style.css           ← all styles with CSS custom properties
```

## Error Handling

Partial failures never crash the server.

| Situation | Response |
|---|---|
| Route not in cache | 404 page with path and ← Back to home |
| Markdoc render error | 500 page with error message inline |
| `cdn/` missing or empty | CDN server shows "Nothing deployed yet" |
| Some `.md` files fail at startup | Server starts with remaining pages; broken routes return 500 |

## Development

```bash
npm install
npm test          # run vitest
npm run test:watch

# run against the example project
cd example
npx tsx ../src/cli.ts preview
npx tsx ../src/cli.ts build
npx tsx ../src/cli.ts deploy
```
