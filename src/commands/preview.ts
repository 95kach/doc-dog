import * as path from 'node:path'
import chokidar from 'chokidar'
import { loadConfig } from '../core/config.js'
import { discoverFiles, filePathToRoute } from '../core/discover.js'
import { PageCache } from '../core/cache.js'
import { createDevServer, findFreePort } from '../server/dev-server.js'

export async function preview(cwd: string = process.cwd()): Promise<void> {
  const { config, runtime } = loadConfig(cwd)

  const entries = discoverFiles(config.docsDir)
  const cache = new PageCache()
  await cache.build(entries)

  const failures = cache.getFailures()
  if (failures.length > 0) {
    console.warn(`\n⚠  ${failures.length} page(s) failed to render:`)
    for (const f of failures) {
      console.warn(`  ✗ ${f.filePath}\n    ${f.error}`)
    }
  }

  const { app, sse } = createDevServer(cache, config)
  const port = await findFreePort(runtime.port)
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`\n🐕 doc-dog running at http://localhost:${port}\n`)

  const watcher = chokidar.watch(config.docsDir, { ignoreInitial: true })

  watcher.on('change', (filePath: string) => {
    const route = cache.getRouteForFile(filePath)
    if (route) {
      cache.update(filePath, route)
      sse.broadcast()
      console.log(`  ↺ ${path.relative(cwd, filePath)}`)
    }
  })

  watcher.on('add', (filePath: string) => {
    if (!filePath.endsWith('.md')) return
    const route = filePathToRoute(config.docsDir, filePath)
    cache.update(filePath, route)
    cache.rebuildNav()
    sse.broadcast()
    console.log(`  + ${path.relative(cwd, filePath)}`)
  })

  watcher.on('unlink', (filePath: string) => {
    const route = cache.getRouteForFile(filePath)
    if (route) {
      cache.remove(route)
      sse.broadcast()
      console.log(`  - ${path.relative(cwd, filePath)}`)
    }
  })
}
