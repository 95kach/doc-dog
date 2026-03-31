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
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ name: 'Test Docs', docsDir: './docs' })
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
})
