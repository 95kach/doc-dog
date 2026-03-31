import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { createDevServer } from '../../src/server/dev-server.js'
import { PageCache } from '../../src/core/cache.js'
import type { Config } from '../../src/types.js'

const config: Config = { name: 'Test Site', docsDir: '/tmp/docs' }

async function makeCache(pages: Record<string, string>): Promise<PageCache> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
  const entries = Object.entries(pages).map(([route, content]) => {
    const slug = route === '/' ? 'index' : route.slice(1)
    const filePath = path.join(tmpDir, `${slug}.md`)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
    return { filePath, route }
  })
  const cache = new PageCache()
  await cache.build(entries)
  return cache
}

describe('createDevServer', () => {
  it('returns 200 and HTML for a known route', async () => {
    const cache = await makeCache({ '/': '# Home' })
    const { app } = createDevServer(cache, config)
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.body).toContain('Test Site')
  })

  it('returns 404 HTML for unknown route', async () => {
    const cache = await makeCache({ '/': '# Home' })
    const { app } = createDevServer(cache, config)
    const res = await app.inject({ method: 'GET', url: '/nonexistent' })
    expect(res.statusCode).toBe(404)
    expect(res.body).toContain('404')
    expect(res.body).toContain('/nonexistent')
  })

  it('returns 500 HTML for a failed page', async () => {
    const cache = new PageCache()
    cache.set('/broken', { ok: false, route: '/broken', filePath: '/x.md', error: 'parse error at line 5' })
    cache.rebuildNav()
    const { app } = createDevServer(cache, config)
    const res = await app.inject({ method: 'GET', url: '/broken' })
    expect(res.statusCode).toBe(500)
    expect(res.body).toContain('parse error at line 5')
  })

  it('exposes an SSE manager with no clients initially', () => {
    const cache = new PageCache()
    const { sse } = createDevServer(cache, config)
    expect(sse.size).toBe(0)
  })

  it('injects live reload script into page HTML', async () => {
    const cache = await makeCache({ '/': '# Home' })
    const { app } = createDevServer(cache, config)
    const res = await app.inject({ method: 'GET', url: '/' })
    expect(res.body).toContain('EventSource')
  })
})
