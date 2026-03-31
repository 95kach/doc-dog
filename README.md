# doc-dog

A CLI tool that turns a directory of Markdown files and OpenAPI specs into a documentation website using [Markdoc](https://markdoc.dev). Lightweight alternative to Redocly Realm.

## Usage

Run from inside a project directory that contains `docdog.yaml`:

```bash
npx @docdog/cli preview   # dev server with live reload
npx @docdog/cli build     # static HTML export → dist/
npx @docdog/cli deploy    # build + copy to cdn/ + local CDN server
```

## Configuration

**`docdog.yaml`** — content config, lives next to your docs:

```yaml
name: My Project
docsDir: ./docs
logo:
  image: ./images/logo.svg
customCss: ./theme-overrides.css
openApiDir: ./api
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Site name shown in the navbar |
| `docsDir` | no | Path to markdown docs (default: `./docs`) |
| `logo.image` | no | Path to logo image (SVG, PNG, etc.) |
| `customCss` | no | Path to CSS file appended after default styles |
| `openApiDir` | no | Path to directory of OpenAPI 3.x spec files |

**`.env`** — runtime/infra config:

```
PORT=3000
LOCAL_CDN_PORT=3100
LOCAL_CDN_DIR=../cdn
```

### Sidebar (`docs/sidebars.yaml`)

Define page labels and sidebar order. Without this file the sidebar is auto-generated from the file tree.

Entries can reference markdown pages (`page:`) or any route (`route:`), including OpenAPI-generated routes:

```yaml
- page: index.md
  label: Start here
- route: /get-jobs
  label: List Jobs
- page: creating-jobs.md
  label: Creating Jobs Guide
- route: /post-jobs
  label: Create Job
- route: /get-jobs-id
  label: Job Status
```

### Custom CSS

Add a `customCss` field to `docdog.yaml` pointing to your CSS file. It is appended after the default styles, so you can override any CSS custom property:

```css
:root {
  --accent: #e11d48;
}
```

### Theming

All styles are defined as CSS custom properties:

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
  --api-get:         #22c55e;
  --api-post:        #3b82f6;
  --api-put:         #f97316;
  --api-delete:      #ef4444;
  --api-patch:       #eab308;
}
```

## OpenAPI Support

Place OpenAPI 3.x spec files (`.yaml`, `.yml`, or `.json`) in a directory and set `openApiDir` in your config. Each operation becomes a styled page with:

- Method badge (GET, POST, PUT, DELETE, PATCH)
- Path with highlighted parameters
- Parameters table
- Request body schema
- Response schemas
- Curl and fetch examples

Routes are generated as `/{method}-{path}` (e.g., `GET /jobs/{id}` → `/get-jobs-id`). With multiple spec files, the spec name is prefixed: `/{specName}/{method}-{path}`.

OpenAPI routes can be mixed with markdown pages in the sidebar. Changes to spec files trigger live reload in preview mode.

## File → Route Mapping

**Markdown:**

| File | Route |
|---|---|
| `docs/index.md` | `/` |
| `docs/guide.md` | `/guide` |
| `docs/jobs/index.md` | `/jobs` |

**OpenAPI** (from `api/chop-chop.yaml`):

| Operation | Route |
|---|---|
| `GET /jobs` | `/get-jobs` |
| `POST /jobs` | `/post-jobs` |
| `GET /jobs/{id}` | `/get-jobs-id` |

## Architecture

```
CWD (docdog.yaml + .env)
         │
         ▼
   ┌─────────────┐
   │   Config    │  name, docsDir, logo, customCss, openApiDir
   │   Loader    │
   └──────┬──────┘
          │
    ┌─────┴──────────────────┐
    ▼                        ▼
┌─────────────┐   ┌──────────────────────┐
│    File     │   │  OpenAPI Discovery   │
│  Discoverer │   │  swagger-parser →    │
│  .md files  │   │  ParsedOperation[]   │
└──────┬──────┘   └──────────┬───────────┘
       │                     │
       ▼                     ▼
┌────────────────┐  ┌────────────────────┐
│ Markdoc Render │  │ OpenAPI Render     │
│ .md → HTML     │  │ operation → HTML   │
└───────┬────────┘  └────────┬───────────┘
        │                    │
        └────────┬───────────┘
                 ▼
  ┌────────────────────────────────┐
  │  Page Cache                    │
  │  Map<route, PageResult>        │
  │  + NavTree (sidebars.yaml      │
  │    or auto-generated)          │
  └───────┬────────────────┬───────┘
          │                │
┌─────────▼────┐    ┌──────▼──────────────────┐
│  preview     │    │  build / deploy         │
└─────────┬────┘    └──────┬──────────────────┘
          │                │
   ┌──────┤         ┌──────▼─────────┐
   │      │         │  HTML Writer   │
   ▼      ▼         │  dist/ folder  │
┌──────┐ ┌───────┐  └──────┬─────────┘
│Fastify│ │Watcher│        │ deploy only
│:PORT  │ │chokidar        ▼
└──┬───┘ └───┬───┘  ┌──────────────────┐
   │         │      │  cdn/ folder     │
   │    SSE  │      │  Static Server   │
   ▼  broadcast     │  :CDN_PORT       │
┌──────┐    │      └──────────────────┘
│Browser│◀──┘
└──────┘
```

### Source layout

```
src/
├── cli.ts                  ← commander entry point (preview, build, deploy)
├── types.ts                ← shared types: PageResult, NavItem, Config, ParsedOperation
├── core/
│   ├── config.ts           ← load docdog.yaml + .env, validate with zod
│   ├── discover.ts         ← walk docsDir → [{ filePath, route }]
│   ├── discover-openapi.ts ← parse OpenAPI specs → ParsedOperation[]
│   ├── render-openapi.ts   ← ParsedOperation → HTML string
│   ├── renderer.ts         ← Markdoc: .md → { ok, html } | { ok: false, error }
│   ├── css.ts              ← buildCss: default styles + custom CSS overrides
│   ├── nav.ts              ← routes + sidebars.yaml → NavItem[]
│   ├── sidebar.ts          ← load and parse sidebars.yaml
│   ├── cache.ts            ← PageCache: Map<route, PageResult> + navTree
│   └── minify.ts           ← HTML/CSS minification + size formatting
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
