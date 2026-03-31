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
    await app.register(fastifyStatic, {
      root: path.resolve(cdnDir),
      index: 'index.html',
    })
  }

  return app
}
