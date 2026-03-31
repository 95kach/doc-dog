import Fastify from 'fastify'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as path from 'node:path'
import type { PageCache } from '../core/cache.js'
import type { Config } from '../types.js'
import { SSEManager } from './sse.js'
import { renderLayout, render404, STYLE_PATH } from '../templates/layout.js'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
}

export function createDevServer(cache: PageCache, config: Config) {
  const app = Fastify({ logger: false })
  const sse = new SSEManager()

  app.get('/style.css', (_, reply) =>
    reply.type('text/css').send(fs.readFileSync(STYLE_PATH))
  )

  // Resolve logo route (e.g. /__logo.png) if logo is configured
  let logoSrc: string | null = null
  if (config.logo) {
    const logoFile = config.logo.image
    const ext = path.extname(logoFile).slice(1).toLowerCase()
    const mime = MIME[ext] ?? 'application/octet-stream'
    logoSrc = `/__logo.${ext}`

    app.get(logoSrc, (_, reply) => {
      if (!fs.existsSync(logoFile)) {
        return reply.status(404).send('Logo file not found')
      }
      return reply.type(mime).send(fs.readFileSync(logoFile))
    })
  }

  app.get('/sse', (_, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    sse.add(reply)
    return reply
  })

  app.get('/*', (req, reply) => {
    const raw = (req.params as Record<string, string>)['*'] ?? ''
    const route = raw === '' ? '/' : `/${raw}`
    const page = cache.get(route)

    if (!page) {
      return reply.status(404).type('text/html').send(render404(route, config.name))
    }

    const html = renderLayout({ page, navTree: cache.navTree, siteName: config.name, liveReload: true, logoSrc })
    return reply.status(page.ok ? 200 : 500).type('text/html').send(html)
  })

  return { app, sse }
}

export async function findFreePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 10; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const srv = net.createServer()
      srv.listen(port, () => { srv.close(); resolve(true) })
      srv.on('error', () => resolve(false))
    })
    if (free) return port
  }
  throw new Error(`No free port found starting from ${startPort}`)
}
