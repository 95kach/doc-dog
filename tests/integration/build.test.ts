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
})
