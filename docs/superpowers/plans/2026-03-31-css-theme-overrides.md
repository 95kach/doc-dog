# CSS Theme Overrides + YAML Config Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate config from JSON to YAML, add `customCss` field that appends user CSS after default styles.

**Architecture:** Config loader switches from `docdog.config.json` (JSON.parse) to `docdog.yaml` (yaml.parse). A new `buildCss()` function reads the default `style.css` and optionally concatenates a user-provided CSS file. Both dev-server and build command use `buildCss()`.

**Tech Stack:** `yaml` v2 (already installed), `zod` (existing), `vitest` (existing)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types.ts` | Modify | Add `customCss?: string` to `Config` |
| `src/core/config.ts` | Modify | YAML parsing, `customCss` schema + resolution |
| `src/core/css.ts` | Create | `buildCss()` — concatenate default + custom CSS |
| `src/commands/build.ts` | Modify | Use `buildCss()` instead of raw file read |
| `src/server/dev-server.ts` | Modify | Use `buildCss()` for `/style.css` route |
| `src/commands/preview.ts` | Modify | Watch custom CSS file for live reload |
| `tests/core/config.test.ts` | Modify | Update all tests from JSON to YAML |
| `tests/core/css.test.ts` | Create | Tests for `buildCss()` |
| `tests/integration/build.test.ts` | Modify | Update config fixture from JSON to YAML |
| `example/docdog.yaml` | Create | Replace `docdog.config.json` |
| `example/docdog.config.json` | Delete | Replaced by YAML |
| `example/docs/docdog.yaml` | Delete | Unused legacy file |
| `example/theme-overrides.css` | Create | Sample custom CSS |

---

### Task 1: Update Config Type

**Files:**
- Modify: `src/types.ts:11-15`

- [ ] **Step 1: Add `customCss` to Config type**

In `src/types.ts`, add the `customCss` field to the `Config` type:

```typescript
export type Config = {
  name: string     // shown in top-left navbar
  docsDir: string  // absolute path, resolved from CWD
  logo?: { image: string }  // absolute path to logo image file
  customCss?: string  // absolute path to custom CSS file
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No errors (customCss is optional, so no downstream breakage)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add customCss field to Config type"
```

---

### Task 2: Migrate Config Loader to YAML

**Files:**
- Modify: `src/core/config.ts`
- Modify: `tests/core/config.test.ts`

- [ ] **Step 1: Write failing tests for YAML config loading**

Replace the entire contents of `tests/core/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadConfig } from '../../src/core/config.js'

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  it('loads valid YAML config with name and docsDir', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Site\ndocsDir: ./docs\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.name).toBe('Test Site')
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('uses default docsDir when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('reads PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    process.env.PORT = '4000'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.port).toBe(4000)
  })

  it('reads LOCAL_CDN_PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    process.env.LOCAL_CDN_PORT = '4100'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.cdnPort).toBe(4100)
  })

  it('throws ZodError when name is missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'docsDir: ./docs\n'
    )
    expect(() => loadConfig(tmpDir)).toThrow()
  })

  it('throws when docdog.yaml is missing', () => {
    expect(() => loadConfig(tmpDir)).toThrow(/docdog\.yaml/)
  })

  it('resolves customCss to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\ncustomCss: ./theme.css\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.customCss).toBe(path.resolve(tmpDir, './theme.css'))
  })

  it('omits customCss when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.customCss).toBeUndefined()
  })

  it('resolves logo.image to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\nlogo:\n  image: ./logo.svg\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.logo?.image).toBe(path.resolve(tmpDir, './logo.svg'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/config.test.ts`
Expected: FAIL — config loader still looks for `docdog.config.json`

- [ ] **Step 3: Update config loader to use YAML**

Replace the entire contents of `src/core/config.ts`:

```typescript
import { z } from 'zod'
import * as fs from 'node:fs'
import * as path from 'node:path'
import YAML from 'yaml'
import dotenv from 'dotenv'
import type { Config, Runtime } from '../types.js'

const ConfigSchema = z.object({
  name: z.string(),
  docsDir: z.string().default('./docs'),
  logo: z.object({ image: z.string() }).optional(),
  customCss: z.string().optional(),
})

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOCAL_CDN_PORT: z.coerce.number().default(3100),
  LOCAL_CDN_DIR: z.string().default('../cdn'),
})

export function loadConfig(cwd: string): { config: Config; runtime: Runtime } {
  const envPath = path.join(cwd, '.env')
  const fileEnv = fs.existsSync(envPath)
    ? dotenv.parse(fs.readFileSync(envPath, 'utf-8'))
    : {}
  const mergedEnv = { ...process.env, ...fileEnv }

  const configPath = path.join(cwd, 'docdog.yaml')
  if (!fs.existsSync(configPath)) {
    throw new Error(`docdog.yaml not found in ${cwd}`)
  }

  const raw = YAML.parse(fs.readFileSync(configPath, 'utf-8'))
  const parsed = ConfigSchema.parse(raw)
  const env = EnvSchema.parse(mergedEnv)

  return {
    config: {
      name: parsed.name,
      docsDir: path.resolve(cwd, parsed.docsDir),
      logo: parsed.logo ? { image: path.resolve(cwd, parsed.logo.image) } : undefined,
      customCss: parsed.customCss ? path.resolve(cwd, parsed.customCss) : undefined,
    },
    runtime: {
      port: env.PORT,
      cdnPort: env.LOCAL_CDN_PORT,
      cdnDir: path.resolve(cwd, env.LOCAL_CDN_DIR),
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/config.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat: migrate config from docdog.config.json to docdog.yaml"
```

---

### Task 3: Create `buildCss()` Function

**Files:**
- Create: `src/core/css.ts`
- Create: `tests/core/css.test.ts`

- [ ] **Step 1: Write failing tests for `buildCss()`**

Create `tests/core/css.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { buildCss } from '../../src/core/css.js'

describe('buildCss', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-css-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('returns default CSS when no customCssPath is provided', () => {
    const css = buildCss()
    expect(css).toContain(':root')
    expect(css).toContain('--accent')
  })

  it('returns default CSS when customCssPath is undefined', () => {
    const css = buildCss(undefined)
    expect(css).toContain(':root')
  })

  it('concatenates custom CSS after default CSS', () => {
    const customPath = path.join(tmpDir, 'custom.css')
    fs.writeFileSync(customPath, ':root { --accent: red; }')
    const css = buildCss(customPath)
    expect(css).toContain('--accent')
    expect(css).toContain(':root { --accent: red; }')
    // Custom CSS should come after default
    const defaultEnd = css.indexOf('--accent-live')
    const customStart = css.indexOf(':root { --accent: red; }')
    expect(customStart).toBeGreaterThan(defaultEnd)
  })

  it('warns and returns default CSS when custom file does not exist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const css = buildCss('/nonexistent/custom.css')
    expect(css).toContain(':root')
    expect(css).not.toContain('custom')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
    warnSpy.mockRestore()
  })

  it('returns default CSS when custom file is empty', () => {
    const customPath = path.join(tmpDir, 'empty.css')
    fs.writeFileSync(customPath, '')
    const css = buildCss(customPath)
    expect(css).not.toContain('/* custom overrides */')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/css.test.ts`
Expected: FAIL — `src/core/css.ts` does not exist

- [ ] **Step 3: Implement `buildCss()`**

Create `src/core/css.ts`:

```typescript
import * as fs from 'node:fs'
import { STYLE_PATH } from '../templates/layout.js'

export function buildCss(customCssPath?: string): string {
  const defaultCss = fs.readFileSync(STYLE_PATH, 'utf-8')

  if (!customCssPath) return defaultCss

  if (!fs.existsSync(customCssPath)) {
    console.warn(`  ⚠  custom CSS not found: ${customCssPath}`)
    return defaultCss
  }

  const customCss = fs.readFileSync(customCssPath, 'utf-8')
  if (!customCss.trim()) return defaultCss

  return defaultCss + '\n/* custom overrides */\n' + customCss
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/core/css.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/css.ts tests/core/css.test.ts
git commit -m "feat: add buildCss() for concatenating default + custom CSS"
```

---

### Task 4: Wire `buildCss()` Into Build Command

**Files:**
- Modify: `src/commands/build.ts`
- Modify: `tests/integration/build.test.ts`

- [ ] **Step 1: Write a failing test for custom CSS in build output**

Add to `tests/integration/build.test.ts` — first update the existing `beforeEach` to write `docdog.yaml` instead of `docdog.config.json`, then add the new test.

Replace the entire contents of `tests/integration/build.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { build } from '../../src/commands/build.js'

describe('build command', () => {
  let tmpDir: string
  let distDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
    distDir = path.join(tmpDir, 'dist')
    const docsDir = path.join(tmpDir, 'docs')
    fs.mkdirSync(path.join(docsDir, 'jobs'), { recursive: true })
    fs.writeFileSync(path.join(docsDir, 'index.md'), '# Home\n\nWelcome.')
    fs.writeFileSync(path.join(docsDir, 'submit.md'), '# Submit\n\nPost a URL.')
    fs.writeFileSync(path.join(docsDir, 'jobs', 'status.md'), '# Status\n\nCheck job.')
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Docs\ndocsDir: ./docs\n'
    )
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  it('creates dist/index.html for the root route', async () => {
    await build(tmpDir, distDir)
    expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true)
  })

  it('creates dist/submit/index.html for /submit', async () => {
    await build(tmpDir, distDir)
    expect(fs.existsSync(path.join(distDir, 'submit', 'index.html'))).toBe(true)
  })

  it('creates nested dist/jobs/status/index.html', async () => {
    await build(tmpDir, distDir)
    expect(fs.existsSync(path.join(distDir, 'jobs', 'status', 'index.html'))).toBe(true)
  })

  it('includes site name in output HTML', async () => {
    await build(tmpDir, distDir)
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')
    expect(html).toContain('Test Docs')
  })

  it('does NOT include EventSource live reload script', async () => {
    await build(tmpDir, distDir)
    const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8')
    expect(html).not.toContain('EventSource')
  })

  it('returns the distDir path', async () => {
    const result = await build(tmpDir, distDir)
    expect(result).toBe(distDir)
  })

  it('includes custom CSS in built style.css', async () => {
    const customCssPath = path.join(tmpDir, 'theme.css')
    fs.writeFileSync(customCssPath, ':root { --accent: #e11d48; }')
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Docs\ndocsDir: ./docs\ncustomCss: ./theme.css\n'
    )
    await build(tmpDir, distDir)
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf-8')
    expect(css).toContain('#e11d48')
  })

  it('builds without error when customCss file is missing', async () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Docs\ndocsDir: ./docs\ncustomCss: ./nonexistent.css\n'
    )
    await build(tmpDir, distDir)
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf-8')
    expect(css).toContain(':root')
    expect(css).not.toContain('#e11d48')
  })
})
```

- [ ] **Step 2: Run tests to verify the new tests fail**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/integration/build.test.ts`
Expected: All tests using `docdog.yaml` fail (build still looks for JSON). The two new custom CSS tests also fail.

- [ ] **Step 3: Update build command to use `buildCss()`**

In `src/commands/build.ts`, make these changes:

1. Replace the `STYLE_PATH` import with `buildCss` import:

Change:
```typescript
import { renderLayout, STYLE_PATH } from '../templates/layout.js'
```
To:
```typescript
import { renderLayout } from '../templates/layout.js'
import { buildCss } from '../core/css.js'
```

2. Replace the CSS read + minify section. Change:
```typescript
  // Minify and write style.css
  const rawCss = fs.readFileSync(STYLE_PATH, 'utf-8')
  const minCss = await minifyCss(rawCss)
  fs.writeFileSync(path.join(distDir, 'style.css'), minCss)
```
To:
```typescript
  // Minify and write style.css (default + custom overrides)
  const rawCss = buildCss(config.customCss)
  const minCss = await minifyCss(rawCss)
  fs.writeFileSync(path.join(distDir, 'style.css'), minCss)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/mp/Downloads/doc-dog && npx vitest run tests/integration/build.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/build.ts tests/integration/build.test.ts
git commit -m "feat: use buildCss() in build command for custom CSS support"
```

---

### Task 5: Wire `buildCss()` Into Dev Server

**Files:**
- Modify: `src/server/dev-server.ts`

- [ ] **Step 1: Update dev server to use `buildCss()`**

In `src/server/dev-server.ts`:

1. Replace the `STYLE_PATH` import:

Change:
```typescript
import { renderLayout, render404, STYLE_PATH } from '../templates/layout.js'
```
To:
```typescript
import { renderLayout, render404 } from '../templates/layout.js'
import { buildCss } from '../core/css.js'
```

2. Replace the `/style.css` route. Change:
```typescript
  app.get('/style.css', (_, reply) =>
    reply.type('text/css').send(fs.readFileSync(STYLE_PATH))
  )
```
To:
```typescript
  app.get('/style.css', (_, reply) =>
    reply.type('text/css').send(buildCss(config.customCss))
  )
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/server/dev-server.ts
git commit -m "feat: use buildCss() in dev server for custom CSS support"
```

---

### Task 6: Watch Custom CSS for Live Reload

**Files:**
- Modify: `src/commands/preview.ts`

- [ ] **Step 1: Add custom CSS file to chokidar watch list**

In `src/commands/preview.ts`, after the existing `chokidar.watch(config.docsDir, ...)` line, add watching for the custom CSS file.

Change:
```typescript
  const watcher = chokidar.watch(config.docsDir, { ignoreInitial: true })
```
To:
```typescript
  const watchPaths: string[] = [config.docsDir]
  if (config.customCss) watchPaths.push(config.customCss)
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true })
```

Then in the `watcher.on('change', ...)` handler, add a check for custom CSS changes. Change:

```typescript
  watcher.on('change', (filePath: string) => {
    const route = cache.getRouteForFile(filePath)
    if (route) {
      cache.update(filePath, route)
      sse.broadcast()
      console.log(`  ↺ ${path.relative(cwd, filePath)}`)
    }
  })
```
To:
```typescript
  watcher.on('change', (filePath: string) => {
    if (config.customCss && path.resolve(filePath) === config.customCss) {
      sse.broadcast()
      console.log(`  ↺ ${path.relative(cwd, filePath)} (custom CSS)`)
      return
    }
    const route = cache.getRouteForFile(filePath)
    if (route) {
      cache.update(filePath, route)
      sse.broadcast()
      console.log(`  ↺ ${path.relative(cwd, filePath)}`)
    }
  })
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/commands/preview.ts
git commit -m "feat: watch custom CSS file for live reload"
```

---

### Task 7: Update Example Project

**Files:**
- Create: `example/docdog.yaml`
- Delete: `example/docdog.config.json`
- Delete: `example/docs/docdog.yaml`
- Create: `example/theme-overrides.css`

- [ ] **Step 1: Create `example/docdog.yaml`**

Create `example/docdog.yaml`:

```yaml
name: Chop-Chop
docsDir: ./docs
logo:
  image: ./images/logo.svg
customCss: ./theme-overrides.css
```

- [ ] **Step 2: Create `example/theme-overrides.css`**

Create `example/theme-overrides.css`:

```css
:root {
  --accent: #e11d48;
}
```

- [ ] **Step 3: Delete old config files**

```bash
rm example/docdog.config.json
rm example/docs/docdog.yaml
```

- [ ] **Step 4: Run full test suite**

Run: `cd /Users/mp/Downloads/doc-dog && npm test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add example/docdog.yaml example/theme-overrides.css
git rm example/docdog.config.json example/docs/docdog.yaml
git commit -m "feat: migrate example project to YAML config with custom CSS"
```

---

### Task 8: Run Full Verification

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/mp/Downloads/doc-dog && npm test`
Expected: All tests PASS

- [ ] **Step 2: TypeScript compilation check**

Run: `cd /Users/mp/Downloads/doc-dog && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test — build**

Run: `cd /Users/mp/Downloads/doc-dog/example && npx tsx ../src/cli.ts build`
Expected: Build succeeds, `dist/style.css` contains the `#e11d48` accent color from the custom CSS

- [ ] **Step 4: Verify custom CSS in build output**

Run: `grep '#e11d48' /Users/mp/Downloads/doc-dog/example/dist/style.css`
Expected: Match found — custom CSS is included in the built output

- [ ] **Step 5: Manual smoke test — preview**

Run: `cd /Users/mp/Downloads/doc-dog/example && npx tsx ../src/cli.ts preview`
Expected: Server starts, pages load in browser, accent color is rose (#e11d48) instead of default blue
