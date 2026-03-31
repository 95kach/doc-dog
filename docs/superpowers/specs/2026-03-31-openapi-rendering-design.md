# OpenAPI Rendering

**Date:** 2026-03-31
**Status:** Draft
**Depends on:** CSS Theme Overrides + YAML Config Migration (for `docdog.yaml` format)

## Summary

Parse OpenAPI 3.x specs from a directory and render each endpoint as a styled HTML page, mixed into the docs site navigation alongside markdown pages. Each endpoint page shows method, path, description, parameters, request/response schemas, and generated example requests.

## Config

New optional field in `docdog.yaml`:

```yaml
name: Chop-Chop
docsDir: ./docs
openApiDir: ./api    # optional — directory containing OpenAPI spec files
```

### Zod schema addition

```typescript
openApiDir: z.string().optional(),
```

Resolved to absolute path in `loadConfig()`, same as `docsDir`.

### Config type addition

```typescript
export type Config = {
  name: string
  docsDir: string
  logo?: { image: string }
  customCss?: string
  openApiDir?: string  // absolute path to directory of OpenAPI specs
}
```

## Discovery

### `src/core/discover-openapi.ts` (new file)

```typescript
export function discoverOpenApiSpecs(openApiDir: string): OpenApiSpec[]
```

- Walks `openApiDir` for `*.yaml` and `*.json` files
- For each file, checks for the `openapi` key (must be `3.x.x`)
- Parses and dereferences `$ref`s using a parser library
- Returns parsed spec objects

### Route Convention

Each operation becomes a page with route derived from the spec:

- Spec file: `api/chop-chop.yaml`
- Operation: `GET /jobs`
- Route: `/api/get-jobs` (prefix from spec file name, then `{method}-{normalized-path}`)

Path parameters in the URL are normalized: `/jobs/{id}` → `jobs-id`

Full route formula: `/{specBaseName}/{method}-{normalizedPath}`

If only one spec file exists, the spec name prefix can be omitted to keep routes clean.

## Rendering

### `src/core/render-openapi.ts` (new file)

```typescript
export function renderOpenApiOperation(operation: ParsedOperation): PageResult
```

Each endpoint page renders HTML with these sections:

### 1. Method Badge + Path

```html
<div class="api-endpoint">
  <span class="api-method api-method--get">GET</span>
  <code class="api-path">/jobs/<span class="api-param">{id}</span></code>
</div>
```

Method badges are color-coded:
- GET: green
- POST: blue
- PUT: orange
- DELETE: red
- PATCH: yellow

### 2. Description

Operation `summary` and `description` rendered as HTML (description may contain markdown).

### 3. Parameters Table

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| id | path | string | yes | The job ID |
| limit | query | integer | no | Max results |

### 4. Request Body Schema

Rendered as a nested property table showing the JSON schema:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| name | string | yes | Job name |
| config | object | no | Job configuration |
| config.retries | integer | no | Retry count |

Nested objects are flattened with dot notation.

### 5. Response Schemas

Grouped by status code:

**200 OK**
| Property | Type | Description |
|----------|------|-------------|
| id | string | Job ID |
| status | string | Current status |

**404 Not Found**
| Property | Type | Description |
|----------|------|-------------|
| error | string | Error message |

### 6. Example Requests

Generated curl and fetch examples:

```
curl -X GET https://api.example.com/jobs/abc123
```

```javascript
fetch('https://api.example.com/jobs/abc123')
  .then(res => res.json())
```

Base URL comes from the OpenAPI spec's `servers[0].url` field.

## Navigation Integration

OpenAPI pages are mixed into the nav tree alongside markdown pages. Two options for ordering:

1. **If `sidebars.yaml` references them:** placed exactly where specified
2. **If not referenced:** appended after markdown pages, grouped by OpenAPI tag

The `NavItem` type stays the same. OpenAPI pages produce nav entries with:
- `label`: Operation summary or `{METHOD} {path}`
- `href`: the generated route

## CSS Classes

New CSS classes for OpenAPI rendering are added to the default `style.css`:

```css
.api-endpoint { ... }
.api-method { ... }
.api-method--get { color: var(--api-get, #22c55e); }
.api-method--post { color: var(--api-post, #3b82f6); }
.api-method--put { color: var(--api-put, #f97316); }
.api-method--delete { color: var(--api-delete, #ef4444); }
.api-method--patch { color: var(--api-patch, #eab308); }
.api-path { ... }
.api-param { ... }
.api-params-table { ... }
.api-schema-table { ... }
.api-example { ... }
```

These use CSS custom properties so they're overridable via `customCss`.

## PageCache Integration

`PageCache.build()` currently takes `FileEntry[]` (markdown files). It needs to also accept OpenAPI-derived entries.

Approach: create a unified entry type or have `PageCache.build()` accept both markdown entries and pre-rendered OpenAPI pages. The simplest approach:

1. Render OpenAPI operations into `PageResult[]` before cache building
2. Pass both markdown `FileEntry[]` and OpenAPI `PageResult[]` to the cache
3. Cache stores both in the same `Map<route, PageResult>`

## Dependencies

New dependency needed: `@apidevtools/swagger-parser` (or similar) for:
- Parsing OpenAPI 3.x YAML/JSON specs
- Dereferencing `$ref` pointers
- Validation

## Live Reload

In preview mode, the chokidar watcher should also watch `openApiDir` for changes to spec files. On change, re-parse and re-render affected operations.

## Example Project

Add `example/api/chop-chop.yaml` with a sample OpenAPI 3.x spec matching the existing Chop-Chop API docs (jobs endpoints).

## Files Changed

| File | Change |
|------|--------|
| `src/types.ts` | Add `openApiDir` to Config, add OpenAPI-related types |
| `src/core/config.ts` | Add `openApiDir` to schema and resolution |
| `src/core/discover-openapi.ts` | New: discover and parse OpenAPI specs |
| `src/core/render-openapi.ts` | New: render operations to HTML |
| `src/core/cache.ts` | Accept OpenAPI PageResults alongside markdown |
| `src/core/sidebar.ts` | Generate nav entries for OpenAPI pages |
| `src/templates/style.css` | Add API-specific CSS classes |
| `src/commands/build.ts` | Include OpenAPI pages in build |
| `src/commands/preview.ts` | Watch openApiDir for changes |
| `src/server/dev-server.ts` | No changes (serves from cache as usual) |
| `example/api/chop-chop.yaml` | New: sample OpenAPI spec |
| `example/docdog.yaml` | Add `openApiDir: ./api` |

## What this does NOT do

- No interactive "Try it" console
- No authentication flow rendering
- No webhook rendering
- No OpenAPI 2.x (Swagger) support — 3.x only
- No spec validation errors shown in UI (just console warnings)
