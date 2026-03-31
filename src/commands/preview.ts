import * as path from 'node:path'
import chokidar from 'chokidar'
import { loadConfig } from '../core/config.js'
import { discoverFiles, filePathToRoute } from '../core/discover.js'
import { PageCache } from '../core/cache.js'
import { createDevServer, findFreePort } from '../server/dev-server.js'
import { discoverOpenApiSpecs } from '../core/discover-openapi.js'
import { renderOpenApiOperation } from '../core/render-openapi.js'

export async function preview(cwd: string = process.cwd()): Promise<void> {
  const { config, runtime } = loadConfig(cwd)

  const entries = discoverFiles(config.docsDir)
  const cache = new PageCache(config.docsDir)
  await cache.build(entries)

  const failures = cache.getFailures()
  if (failures.length > 0) {
    console.warn(`\n⚠  ${failures.length} page(s) failed to render:`)
    for (const f of failures) {
      console.warn(`  ✗ ${f.filePath}\n    ${f.error}`)
    }
  }

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

  const { app, sse } = createDevServer(cache, config)
  const port = await findFreePort(runtime.port)
  await app.listen({ port, host: '127.0.0.1' })
  console.log(`\n🐕 doc-dog running at http://localhost:${port}\n`)

  const watchPaths: string[] = [config.docsDir]
  if (config.customCss) watchPaths.push(config.customCss)
  if (config.openApiDir) watchPaths.push(config.openApiDir)
  const watcher = chokidar.watch(watchPaths, { ignoreInitial: true })

  watcher.on('change', (filePath: string) => {
    if (config.customCss && path.resolve(filePath) === config.customCss) {
      sse.broadcast()
      console.log(`  ↺ ${path.relative(cwd, filePath)} (custom CSS)`)
      return
    }
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
