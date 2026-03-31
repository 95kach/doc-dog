import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig } from '../core/config.js'
import { discoverFiles } from '../core/discover.js'
import { PageCache } from '../core/cache.js'
import { renderLayout } from '../templates/layout.js'

export async function build(cwd: string = process.cwd(), outDir?: string): Promise<string> {
  const { config } = loadConfig(cwd)
  const distDir = outDir ?? path.join(cwd, 'dist')

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

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  for (const page of cache.all()) {
    const html = renderLayout({
      page,
      navTree: cache.navTree,
      siteName: config.name,
      liveReload: false,
    })
    const filePath =
      page.route === '/'
        ? path.join(distDir, 'index.html')
        : path.join(distDir, page.route.slice(1), 'index.html')

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, html)
    console.log(`  ✓ ${page.route}`)
  }

  console.log(`\n✓ Built ${cache.all().length} pages → ${path.relative(cwd, distDir)}/`)
  return distDir
}
