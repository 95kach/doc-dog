import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { renderCdnEmpty } from '../templates/layout.js'

export async function createStaticServer(cdnDir: string) {
  const app = Fastify({ logger: false })

  const isEmpty =
    !fs.existsSync(cdnDir) || fs.readdirSync(cdnDir).length === 0

  if (isEmpty) {
    app.get('/*', (_, reply) => {
      return reply.type('text/html').send(renderCdnEmpty())
    })
  } else {
    const root = path.resolve(cdnDir)
    await app.register(fastifyStatic, {
      root,
      index: 'index.html',
    })
    // @fastify/static does not serve index.html for paths without trailing slash
    app.setNotFoundHandler((req, reply) => {
      const urlPath = req.url.split('?')[0].replace(/\/$/, '')
      const indexFile = path.join(root, urlPath, 'index.html')
      if (fs.existsSync(indexFile)) {
        return reply.type('text/html').send(fs.readFileSync(indexFile))
      }
      return reply.status(404).type('text/plain').send('Not found')
    })
  }

  return app
}
