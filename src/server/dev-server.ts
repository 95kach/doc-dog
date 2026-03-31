import Fastify from 'fastify'
import * as net from 'node:net'
import type { PageCache } from '../core/cache.js'
import type { Config } from '../types.js'
import { SSEManager } from './sse.js'
import { renderLayout, render404 } from '../templates/layout.js'

export function createDevServer(cache: PageCache, config: Config) {
  const app = Fastify({ logger: false })
  const sse = new SSEManager()

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

    const html = renderLayout({ page, navTree: cache.navTree, siteName: config.name, liveReload: true })
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
