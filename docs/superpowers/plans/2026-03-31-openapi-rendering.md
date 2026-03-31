# OpenAPI Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse OpenAPI 3.x specs from a directory and render each endpoint as a styled HTML page in the docs site, mixed into navigation alongside markdown pages.

**Architecture:** A new `discoverOpenApiSpecs()` function parses spec files using `@apidevtools/swagger-parser`, extracts operations into `ParsedOperation` objects, and generates routes. A new `renderOpenApiOperation()` function converts each operation to HTML. The build command and preview command call these, then inject the resulting `PageResult` objects into the existing `PageCache` via its `set()` method.

**Tech Stack:** `@apidevtools/swagger-parser` (new dep), `openapi-types` (transitive), existing `yaml`, `vitest`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add `openApiDir` to Config, add `ParsedOperation` and helper types |
| `src/core/config.ts` | Modify | Add `openApiDir` to Zod schema + path resolution |
| `src/core/discover-openapi.ts` | Create | Parse specs, extract operations, generate routes |
| `src/core/render-openapi.ts` | Create | Render `ParsedOperation` → HTML string |
| `src/templates/style.css` | Modify | Add `.api-*` CSS classes |
| `src/commands/build.ts` | Modify | Discover + render OpenAPI pages, add to cache |
| `src/commands/preview.ts` | Modify | Watch `openApiDir` for live reload |
| `tests/core/config.test.ts` | Modify | Add `openApiDir` test |
| `tests/core/discover-openapi.test.ts` | Create | Tests for spec discovery + route generation |
| `tests/core/render-openapi.test.ts` | Create | Tests for HTML rendering |
| `tests/integration/build.test.ts` | Modify | Add test for OpenAPI pages in build output |
| `example/api/chop-chop.yaml` | Create | Sample OpenAPI 3.x spec |
| `example/docdog.yaml` | Modify | Add `openApiDir: ./api` |

---

### Task 1: Config + Types + Dependency

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/config.ts`
- Modify: `tests/core/config.test.ts`

- [ ] **Step 1: Install @apidevtools/swagger-parser**

Run: `cd /Users/mp/Downloads/doc-dog && npm install @apidevtools/swagger-parser`

- [ ] **Step 2: Add OpenAPI types to types.ts**

In `src/types.ts`, add `openApiDir` to Config and add the new types after the existing ones:

```typescript
export type PageResult =
  | { ok: true;  route: string; filePath: string; html: string; frontmatter: Record<string, unknown> }
  | { ok: false; route: string; filePath: string; error: string }

export type NavItem = {
  label: string
  href: string
  children: NavItem[]
}

export type Config = {
  name: string     // shown in top-left navbar
  docsDir: string  // absolute path, resolved from CWD
  logo?: { image: string }  // absolute path to logo image file
  customCss?: string  // absolute path to custom CSS file
  openApiDir?: string // absolute path to directory of OpenAPI specs
}

export type Runtime = {
  port: number     // default 3000
  cdnPort: number  // default 3100 (LOCAL_CDN_PORT)
  cdnDir: string   // absolute path (LOCAL_CDN_DIR)
}

export type FileEntry = { filePath: string; route: string }

export type SidebarEntry = { page: string; label?: string }

export type ApiParam = {
  name: string
  in: string       // path, query, header
  type: string
  required: boolean
  description: string
}

export type ApiProperty = {
  name: string     // dot notation for nested: "config.retries"
  type: string
  required: boolean
  description: string
}

export type ApiResponse = {
  status: string
  description: string
  properties: ApiProperty[]
}

export type ParsedOperation = {
  route: string
  method: string       // lowercase: get, post, put, delete, patch
  path: string         // /jobs/{id}
  summary: string
  description: string
  parameters: ApiParam[]
  requestBody: { description: string; required: boolean; properties: ApiProperty[] } | null
  responses: ApiResponse[]
  baseUrl: string
  specName: string
  filePath: string     // source spec file path
}
```

- [ ] **Step 3: Add openApiDir to config schema**

In `src/core/config.ts`, add `openApiDir` to the Zod schema and resolution.

Change the ConfigSchema:
```typescript
const ConfigSchema = z.object({
  name: z.string(),
  docsDir: z.string().default('./docs'),
  logo: z.object({ image: z.string() }).optional(),
  customCss: z.string().optional(),
  openApiDir: z.string().optional(),
})
```

In the return statement, add after the `customCss` line:
```typescript
      openApiDir: parsed.openApiDir ? path.resolve(cwd, parsed.openApiDir) : undefined,
```

- [ ] **Step 4: Add config test for openApiDir**

In `tests/core/config.test.ts`, add this test at the end of the describe block (before the closing `})`):

```typescript
  it('resolves openApiDir to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\nopenApiDir: ./api\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.openApiDir).toBe(path.resolve(tmpDir, './api'))
  })

  it('omits openApiDir when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.openApiDir).toBeUndefined()
  })
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/config.test.ts`
Expected: All 11 tests PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/types.ts src/core/config.ts tests/core/config.test.ts
git commit -m "feat: add openApiDir config field and OpenAPI types"
```

---

### Task 2: OpenAPI Discovery

**Files:**
- Create: `src/core/discover-openapi.ts`
- Create: `tests/core/discover-openapi.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/discover-openapi.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { discoverOpenApiSpecs, operationToRoute } from '../../src/core/discover-openapi.js'

const MINIMAL_SPEC = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /jobs:
    get:
      summary: List jobs
      description: Returns all jobs.
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
          description: Max results
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
    post:
      summary: Create a job
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                  description: URL to process
      responses:
        '201':
          description: Created
  /jobs/{id}:
    get:
      summary: Get job
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: Job ID
      responses:
        '200':
          description: OK
        '404':
          description: Not Found
`

describe('operationToRoute', () => {
  it('generates route from method and path', () => {
    expect(operationToRoute('api', 'get', '/jobs', false)).toBe('/api/get-jobs')
  })

  it('normalizes path parameters', () => {
    expect(operationToRoute('api', 'get', '/jobs/{id}', false)).toBe('/api/get-jobs-id')
  })

  it('omits spec prefix when singleSpec is true', () => {
    expect(operationToRoute('api', 'get', '/jobs', true)).toBe('/get-jobs')
  })

  it('handles root path', () => {
    expect(operationToRoute('api', 'get', '/', true)).toBe('/get-')
  })

  it('handles deeply nested paths', () => {
    expect(operationToRoute('api', 'get', '/users/{id}/jobs/{jobId}', false))
      .toBe('/api/get-users-id-jobs-jobId')
  })
})

describe('discoverOpenApiSpecs', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-openapi-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('discovers and parses a YAML spec file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops.length).toBe(3)
  })

  it('extracts method and path correctly', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')
    expect(getJobs).toBeDefined()
    expect(getJobs!.summary).toBe('List jobs')
  })

  it('extracts parameters', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')!
    expect(getJobs.parameters).toHaveLength(1)
    expect(getJobs.parameters[0].name).toBe('limit')
    expect(getJobs.parameters[0].in).toBe('query')
  })

  it('extracts request body properties', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const postJobs = ops.find(o => o.method === 'post')!
    expect(postJobs.requestBody).not.toBeNull()
    expect(postJobs.requestBody!.required).toBe(true)
    expect(postJobs.requestBody!.properties.length).toBeGreaterThanOrEqual(1)
    expect(postJobs.requestBody!.properties[0].name).toBe('url')
  })

  it('extracts responses', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJob = ops.find(o => o.path === '/jobs/{id}')!
    expect(getJob.responses).toHaveLength(2)
    expect(getJob.responses[0].status).toBe('200')
    expect(getJob.responses[1].status).toBe('404')
  })

  it('generates routes with spec name prefix (single spec)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')!
    expect(getJobs.route).toBe('/get-jobs')
  })

  it('generates routes with spec name prefix (multiple specs)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'alpha.yaml'), MINIMAL_SPEC)
    fs.writeFileSync(path.join(tmpDir, 'beta.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const alphaOps = ops.filter(o => o.specName === 'alpha')
    expect(alphaOps[0].route).toMatch(/^\/alpha\//)
  })

  it('extracts baseUrl from servers', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops[0].baseUrl).toBe('https://api.example.com')
  })

  it('skips non-OpenAPI files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.yaml'), 'title: Not an API\n')
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops.length).toBe(3) // only from test.yaml
  })

  it('returns empty array for empty directory', async () => {
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/discover-openapi.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement discover-openapi.ts**

Create `src/core/discover-openapi.ts`:

```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParsedOperation, ApiParam, ApiProperty, ApiResponse } from '../types.js'

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const

export function operationToRoute(specName: string, method: string, apiPath: string, singleSpec: boolean): string {
  const normalized = apiPath
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\//g, '-')
  const segment = `${method}-${normalized}`
  return singleSpec ? `/${segment}` : `/${specName}/${segment}`
}

export async function discoverOpenApiSpecs(openApiDir: string): Promise<ParsedOperation[]> {
  if (!fs.existsSync(openApiDir)) return []

  const files = fs.readdirSync(openApiDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
  const specFiles: Array<{ filePath: string; name: string }> = []

  for (const file of files) {
    const filePath = path.join(openApiDir, file)
    try {
      const doc = await SwaggerParser.dereference(filePath) as OpenAPIV3.Document
      if (doc.openapi && doc.openapi.startsWith('3.')) {
        specFiles.push({ filePath, name: path.basename(file, path.extname(file)) })
      }
    } catch {
      // Not a valid OpenAPI spec, skip
    }
  }

  const singleSpec = specFiles.length === 1
  const allOps: ParsedOperation[] = []

  for (const { filePath, name } of specFiles) {
    const doc = await SwaggerParser.dereference(filePath) as OpenAPIV3.Document
    const baseUrl = doc.servers?.[0]?.url ?? ''

    for (const [apiPath, pathItem] of Object.entries(doc.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        const op = (pathItem as OpenAPIV3.PathItemObject)?.[method]
        if (!op) continue

        allOps.push({
          route: operationToRoute(name, method, apiPath, singleSpec),
          method,
          path: apiPath,
          summary: op.summary ?? '',
          description: op.description ?? '',
          parameters: extractParams(op),
          requestBody: extractRequestBody(op),
          responses: extractResponses(op),
          baseUrl,
          specName: name,
          filePath,
        })
      }
    }
  }

  return allOps
}

function extractParams(op: OpenAPIV3.OperationObject): ApiParam[] {
  return (op.parameters ?? []).map(p => {
    const param = p as OpenAPIV3.ParameterObject
    const schema = param.schema as OpenAPIV3.SchemaObject | undefined
    return {
      name: param.name,
      in: param.in,
      type: schema?.type ?? 'string',
      required: param.required ?? false,
      description: param.description ?? '',
    }
  })
}

function extractRequestBody(op: OpenAPIV3.OperationObject): ParsedOperation['requestBody'] {
  const body = op.requestBody as OpenAPIV3.RequestBodyObject | undefined
  if (!body) return null

  const content = body.content?.['application/json']
  const schema = content?.schema as OpenAPIV3.SchemaObject | undefined

  return {
    description: body.description ?? '',
    required: body.required ?? false,
    properties: schema ? flattenProperties(schema) : [],
  }
}

function extractResponses(op: OpenAPIV3.OperationObject): ApiResponse[] {
  return Object.entries(op.responses ?? {}).map(([status, resp]) => {
    const response = resp as OpenAPIV3.ResponseObject
    const content = response.content?.['application/json']
    const schema = content?.schema as OpenAPIV3.SchemaObject | undefined

    return {
      status,
      description: response.description ?? '',
      properties: schema ? flattenProperties(schema) : [],
    }
  })
}

function flattenProperties(schema: OpenAPIV3.SchemaObject, prefix = ''): ApiProperty[] {
  const props: ApiProperty[] = []
  const required = new Set(schema.required ?? [])

  for (const [name, propRef] of Object.entries(schema.properties ?? {})) {
    const prop = propRef as OpenAPIV3.SchemaObject
    const fullName = prefix ? `${prefix}.${name}` : name
    props.push({
      name: fullName,
      type: prop.type ?? 'object',
      required: required.has(name),
      description: prop.description ?? '',
    })
    if (prop.type === 'object' && prop.properties) {
      props.push(...flattenProperties(prop, fullName))
    }
  }

  return props
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/discover-openapi.test.ts`
Expected: All 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/discover-openapi.ts tests/core/discover-openapi.test.ts
git commit -m "feat: add OpenAPI spec discovery and operation extraction"
```

---

### Task 3: OpenAPI Renderer

**Files:**
- Create: `src/core/render-openapi.ts`
- Create: `tests/core/render-openapi.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/core/render-openapi.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderOpenApiOperation } from '../../src/core/render-openapi.js'
import type { ParsedOperation } from '../../src/types.js'

function makeOp(overrides: Partial<ParsedOperation> = {}): ParsedOperation {
  return {
    route: '/get-jobs',
    method: 'get',
    path: '/jobs',
    summary: 'List jobs',
    description: 'Returns all jobs.',
    parameters: [],
    requestBody: null,
    responses: [],
    baseUrl: 'https://api.example.com',
    specName: 'test',
    filePath: '/tmp/test.yaml',
    ...overrides,
  }
}

describe('renderOpenApiOperation', () => {
  it('renders method badge with correct class', () => {
    const html = renderOpenApiOperation(makeOp({ method: 'post' }))
    expect(html).toContain('api-method--post')
    expect(html).toContain('POST')
  })

  it('renders path with highlighted parameters', () => {
    const html = renderOpenApiOperation(makeOp({ path: '/jobs/{id}' }))
    expect(html).toContain('api-param')
    expect(html).toContain('{id}')
  })

  it('renders summary as h1', () => {
    const html = renderOpenApiOperation(makeOp({ summary: 'List jobs' }))
    expect(html).toContain('<h1>List jobs</h1>')
  })

  it('renders description as paragraph', () => {
    const html = renderOpenApiOperation(makeOp({ description: 'Returns all jobs.' }))
    expect(html).toContain('<p>Returns all jobs.</p>')
  })

  it('renders parameters table', () => {
    const html = renderOpenApiOperation(makeOp({
      parameters: [
        { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Max results' },
        { name: 'id', in: 'path', type: 'string', required: true, description: 'Job ID' },
      ],
    }))
    expect(html).toContain('Parameters')
    expect(html).toContain('limit')
    expect(html).toContain('query')
    expect(html).toContain('id')
    expect(html).toContain('path')
  })

  it('renders request body table', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      requestBody: {
        description: 'Job data',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: 'URL to process' },
          { name: 'config', type: 'object', required: false, description: 'Configuration' },
          { name: 'config.retries', type: 'integer', required: false, description: 'Retry count' },
        ],
      },
    }))
    expect(html).toContain('Request Body')
    expect(html).toContain('url')
    expect(html).toContain('config.retries')
  })

  it('renders response schemas grouped by status', () => {
    const html = renderOpenApiOperation(makeOp({
      responses: [
        { status: '200', description: 'OK', properties: [{ name: 'id', type: 'string', required: true, description: 'Job ID' }] },
        { status: '404', description: 'Not Found', properties: [{ name: 'error', type: 'string', required: false, description: 'Error message' }] },
      ],
    }))
    expect(html).toContain('200')
    expect(html).toContain('OK')
    expect(html).toContain('404')
    expect(html).toContain('Not Found')
  })

  it('renders curl example', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'get',
      path: '/jobs/{id}',
      baseUrl: 'https://api.example.com',
    }))
    expect(html).toContain('curl')
    expect(html).toContain('https://api.example.com/jobs/{id}')
  })

  it('renders fetch example', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'get',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
    }))
    expect(html).toContain('fetch')
    expect(html).toContain('https://api.example.com/jobs')
  })

  it('renders POST curl with body', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
      requestBody: {
        description: '',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: '' },
        ],
      },
    }))
    expect(html).toContain('-X POST')
    expect(html).toContain('Content-Type: application/json')
  })

  it('renders POST fetch with body', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
      requestBody: {
        description: '',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: '' },
        ],
      },
    }))
    expect(html).toContain("method: 'POST'")
    expect(html).toContain('body: JSON.stringify')
  })

  it('skips parameters section when empty', () => {
    const html = renderOpenApiOperation(makeOp({ parameters: [] }))
    expect(html).not.toContain('Parameters')
  })

  it('skips request body section when null', () => {
    const html = renderOpenApiOperation(makeOp({ requestBody: null }))
    expect(html).not.toContain('Request Body')
  })

  it('escapes HTML in strings', () => {
    const html = renderOpenApiOperation(makeOp({ summary: 'Get <script>alert(1)</script>' }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/render-openapi.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement render-openapi.ts**

Create `src/core/render-openapi.ts`:

```typescript
import type { ParsedOperation, ApiParam, ApiProperty, ApiResponse } from '../types.js'

export function renderOpenApiOperation(op: ParsedOperation): string {
  const parts: string[] = []

  // 1. Method badge + path
  parts.push(`<div class="api-endpoint">
  <span class="api-method api-method--${op.method}">${op.method.toUpperCase()}</span>
  <code class="api-path">${highlightParams(op.path)}</code>
</div>`)

  // 2. Description
  if (op.summary) parts.push(`<h1>${esc(op.summary)}</h1>`)
  if (op.description) parts.push(`<p>${esc(op.description)}</p>`)

  // 3. Parameters
  if (op.parameters.length > 0) {
    parts.push(`<h2>Parameters</h2>`)
    parts.push(renderParamsTable(op.parameters))
  }

  // 4. Request body
  if (op.requestBody) {
    parts.push(`<h2>Request Body</h2>`)
    if (op.requestBody.description) parts.push(`<p>${esc(op.requestBody.description)}</p>`)
    parts.push(renderPropsTable(op.requestBody.properties, true))
  }

  // 5. Responses
  if (op.responses.length > 0) {
    parts.push(`<h2>Responses</h2>`)
    for (const resp of op.responses) {
      parts.push(`<h3>${esc(resp.status)} ${esc(resp.description)}</h3>`)
      if (resp.properties.length > 0) {
        parts.push(renderPropsTable(resp.properties, false))
      }
    }
  }

  // 6. Examples
  parts.push(`<h2>Examples</h2>`)
  parts.push(renderExamples(op))

  return parts.join('\n')
}

function highlightParams(apiPath: string): string {
  return esc(apiPath).replace(/\{([^}]+)\}/g, '<span class="api-param">{$1}</span>')
}

function renderParamsTable(params: ApiParam[]): string {
  const rows = params.map(p =>
    `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.in)}</td><td><code>${esc(p.type)}</code></td><td>${p.required ? 'yes' : 'no'}</td><td>${esc(p.description)}</td></tr>`
  ).join('\n')
  return `<table class="api-params-table">
<thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function renderPropsTable(props: ApiProperty[], showRequired: boolean): string {
  if (showRequired) {
    const rows = props.map(p =>
      `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(p.type)}</code></td><td>${p.required ? 'yes' : 'no'}</td><td>${esc(p.description)}</td></tr>`
    ).join('\n')
    return `<table class="api-schema-table">
<thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
  }
  const rows = props.map(p =>
    `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(p.type)}</code></td><td>${esc(p.description)}</td></tr>`
  ).join('\n')
  return `<table class="api-schema-table">
<thead><tr><th>Property</th><th>Type</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function renderExamples(op: ParsedOperation): string {
  const url = `${op.baseUrl}${op.path}`
  const method = op.method.toUpperCase()
  const parts: string[] = []

  if (op.requestBody && op.requestBody.properties.length > 0) {
    const body = buildSampleBody(op.requestBody.properties)
    const bodyJson = JSON.stringify(body, null, 2)

    parts.push(`<pre><code>curl -X ${method} ${esc(url)} \\
  -H "Content-Type: application/json" \\
  -d '${esc(bodyJson)}'</code></pre>`)

    parts.push(`<pre><code>fetch('${esc(url)}', {
  method: '${method}',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${esc(bodyJson)})
}).then(res =&gt; res.json())</code></pre>`)
  } else {
    parts.push(`<pre><code>curl -X ${method} ${esc(url)}</code></pre>`)

    parts.push(`<pre><code>fetch('${esc(url)}')
  .then(res =&gt; res.json())</code></pre>`)
  }

  return parts.join('\n')
}

function buildSampleBody(props: ApiProperty[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const p of props) {
    if (p.name.includes('.')) continue // skip nested (parent already creates object)
    body[p.name] = sampleValue(p.type)
  }
  return body
}

function sampleValue(type: string): unknown {
  switch (type) {
    case 'string': return 'string'
    case 'integer': return 0
    case 'number': return 0
    case 'boolean': return true
    case 'array': return []
    case 'object': return {}
    default: return 'string'
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/render-openapi.test.ts`
Expected: All 14 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/render-openapi.ts tests/core/render-openapi.test.ts
git commit -m "feat: add OpenAPI operation renderer"
```

---

### Task 4: API CSS Styles

**Files:**
- Modify: `src/templates/style.css`

- [ ] **Step 1: Add API CSS classes**

Append the following to the end of `src/templates/style.css` (before the closing of the file, after the `.live-badge` block):

```css

/* ── API endpoint pages ─────────────────────────────────── */
.api-endpoint {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 6px;
}
.api-method {
  font-weight: 700;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: var(--radius);
  text-transform: uppercase;
  font-family: monospace;
}
.api-method--get    { color: var(--api-get, #22c55e); background: #f0fdf4 }
.api-method--post   { color: var(--api-post, #3b82f6); background: #eff6ff }
.api-method--put    { color: var(--api-put, #f97316); background: #fff7ed }
.api-method--delete { color: var(--api-delete, #ef4444); background: #fef2f2 }
.api-method--patch  { color: var(--api-patch, #eab308); background: #fefce8 }
.api-path {
  font-size: 15px;
  color: var(--text-heading);
  background: none;
  padding: 0;
}
.api-param { color: var(--accent); font-weight: 600 }
.api-params-table, .api-schema-table { margin-bottom: 16px }
```

- [ ] **Step 2: Verify styles are valid**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/css.test.ts`
Expected: All CSS tests still PASS (buildCss reads this file)

- [ ] **Step 3: Commit**

```bash
git add src/templates/style.css
git commit -m "feat: add API endpoint CSS styles"
```

---

### Task 5: Build Integration

**Files:**
- Modify: `src/commands/build.ts`
- Modify: `tests/integration/build.test.ts`

- [ ] **Step 1: Write failing test for OpenAPI pages in build output**

Add this test at the end of the describe block in `tests/integration/build.test.ts` (before the closing `})`):

```typescript
  it('includes OpenAPI pages in build output', async () => {
    const apiDir = path.join(tmpDir, 'api')
    fs.mkdirSync(apiDir)
    fs.writeFileSync(path.join(apiDir, 'test.yaml'), `openapi: 3.0.3
info:
  title: Test
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /items:
    get:
      summary: List items
      responses:
        '200':
          description: OK
`)
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Docs\ndocsDir: ./docs\nopenApiDir: ./api\n'
    )
    await build(tmpDir, distDir)
    expect(fs.existsSync(path.join(distDir, 'get-items', 'index.html'))).toBe(true)
    const html = fs.readFileSync(path.join(distDir, 'get-items', 'index.html'), 'utf-8')
    expect(html).toContain('List items')
    expect(html).toContain('api-method--get')
  })
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/integration/build.test.ts`
Expected: New test FAILS (OpenAPI pages not yet wired into build)

- [ ] **Step 3: Wire OpenAPI into build command**

In `src/commands/build.ts`, add the import at the top (after the existing imports):

```typescript
import { discoverOpenApiSpecs } from '../core/discover-openapi.js'
import { renderOpenApiOperation } from '../core/render-openapi.js'
```

Then, after `await cache.build(entries)` and the failures check (after line 34), add:

```typescript
  // Discover and render OpenAPI pages
  if (config.openApiDir) {
    const ops = await discoverOpenApiSpecs(config.openApiDir)
    for (const op of ops) {
      const html = renderOpenApiOperation(op)
      cache.set(op.route, { ok: true, route: op.route, filePath: op.filePath, html, frontmatter: {} })
    }
    if (ops.length > 0) {
      cache.rebuildNav()
      console.log(`  📡 ${ops.length} API endpoint(s) from ${config.openApiDir}`)
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/integration/build.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/build.ts tests/integration/build.test.ts
git commit -m "feat: include OpenAPI pages in build output"
```

---

### Task 6: Preview Integration

**Files:**
- Modify: `src/commands/preview.ts`

- [ ] **Step 1: Add OpenAPI discovery to preview startup and watch openApiDir**

In `src/commands/preview.ts`, add the import at the top:

```typescript
import { discoverOpenApiSpecs } from '../core/discover-openapi.js'
import { renderOpenApiOperation } from '../core/render-openapi.js'
```

After `await cache.build(entries)` and the failures check (after line 21), add:

```typescript
  // Discover and render OpenAPI pages
  if (config.openApiDir) {
    const ops = await discoverOpenApiSpecs(config.openApiDir)
    for (const op of ops) {
      const html = renderOpenApiOperation(op)
      cache.set(op.route, { ok: true, route: op.route, filePath: op.filePath, html, frontmatter: {} })
    }
    if (ops.length > 0) {
      cache.rebuildNav()
      console.log(`  📡 ${ops.length} API endpoint(s) from ${config.openApiDir}`)
    }
  }
```

Add `openApiDir` to the watch paths. Change:

```typescript
  const watchPaths: string[] = [config.docsDir]
  if (config.customCss) watchPaths.push(config.customCss)
```

To:

```typescript
  const watchPaths: string[] = [config.docsDir]
  if (config.customCss) watchPaths.push(config.customCss)
  if (config.openApiDir) watchPaths.push(config.openApiDir)
```

In the `watcher.on('change', ...)` handler, add OpenAPI file detection after the customCss check and before the route lookup:

```typescript
    if (config.openApiDir && filePath.startsWith(config.openApiDir)) {
      // Re-parse entire spec directory on any change
      discoverOpenApiSpecs(config.openApiDir).then(ops => {
        for (const op of ops) {
          const html = renderOpenApiOperation(op)
          cache.set(op.route, { ok: true, route: op.route, filePath: op.filePath, html, frontmatter: {} })
        }
        cache.rebuildNav()
        sse.broadcast()
        console.log(`  ↺ ${path.relative(cwd, filePath)} (OpenAPI)`)
      })
      return
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No new errors (pre-existing html-minifier-terser warning is OK)

- [ ] **Step 3: Commit**

```bash
git add src/commands/preview.ts
git commit -m "feat: watch OpenAPI specs for live reload in preview"
```

---

### Task 7: Example Project

**Files:**
- Create: `example/api/chop-chop.yaml`
- Modify: `example/docdog.yaml`

- [ ] **Step 1: Create example OpenAPI spec**

Create directory and file `example/api/chop-chop.yaml`:

```yaml
openapi: 3.0.3
info:
  title: Chop-Chop API
  version: 1.0.0
  description: Job processing API for Chop-Chop
servers:
  - url: https://api.chop-chop.dev
paths:
  /jobs:
    get:
      summary: List jobs
      description: Returns a paginated list of all jobs.
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
          description: Maximum number of results
        - name: offset
          in: query
          schema:
            type: integer
          description: Number of results to skip
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      $ref: '#/components/schemas/Job'
                  total:
                    type: integer
                    description: Total number of jobs
    post:
      summary: Create a job
      description: Submits a new job for processing.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                  description: The URL to process
                callback:
                  type: string
                  description: Webhook URL for completion notification
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Job'
        '400':
          description: Bad Request
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    description: Error message
  /jobs/{id}:
    get:
      summary: Get job status
      description: Returns the current status and details of a specific job.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: The job ID
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Job'
        '404':
          description: Not Found
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                    description: Error message
components:
  schemas:
    Job:
      type: object
      properties:
        id:
          type: string
          description: Unique job identifier
        url:
          type: string
          description: The URL being processed
        status:
          type: string
          description: Current job status
        createdAt:
          type: string
          description: When the job was created
```

- [ ] **Step 2: Update example config**

In `example/docdog.yaml`, add the openApiDir line:

```yaml
name: Chop-Chop
docsDir: ./docs
logo:
  image: ./images/logo.svg
customCss: ./theme-overrides.css
openApiDir: ./api
```

- [ ] **Step 3: Run full test suite**

Run: `cd /Users/mp/Downloads/doc-dog && npm test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add example/api/chop-chop.yaml example/docdog.yaml
git commit -m "feat: add example OpenAPI spec for Chop-Chop API"
```

---

### Task 8: Full Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/mp/Downloads/doc-dog && npm test`
Expected: All tests PASS

- [ ] **Step 2: TypeScript compilation check**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Build smoke test**

Run: `cd /Users/mp/Downloads/doc-dog/example && npx tsx ../src/cli.ts build`
Expected: Build succeeds, shows API endpoint count, generates pages like `dist/get-jobs/index.html`

- [ ] **Step 4: Verify OpenAPI pages in build output**

Run: `ls /Users/mp/Downloads/doc-dog/example/dist/`
Expected: Should contain `get-jobs/`, `post-jobs/`, `get-jobs-id/` directories alongside `index.html`

Run: `grep 'api-method' /Users/mp/Downloads/doc-dog/example/dist/get-jobs/index.html`
Expected: Match found — OpenAPI HTML is present

- [ ] **Step 5: Preview smoke test**

Run: `cd /Users/mp/Downloads/doc-dog/example && npx tsx ../src/cli.ts preview`
Expected: Server starts, API endpoints appear in sidebar navigation, clicking them shows endpoint documentation with method badge, parameters, schemas, and examples
