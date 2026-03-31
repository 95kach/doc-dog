import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig } from '../core/config.js'
import { discoverFiles } from '../core/discover.js'
import { PageCache } from '../core/cache.js'
import { renderLayout, STYLE_PATH } from '../templates/layout.js'
import { minifyHtml, formatBytes, pctSaved } from '../core/minify.js'

function copyLogo(logoFile: string, distDir: string): string | null {
  if (!fs.existsSync(logoFile)) {
    console.warn(`  ⚠  logo not found: ${logoFile}`)
    return null
  }
  const ext = path.extname(logoFile)
  const dest = path.join(distDir, `__logo${ext}`)
  fs.copyFileSync(logoFile, dest)
  return `/__logo${ext}`
}

export async function build(cwd: string = process.cwd(), outDir?: string): Promise<string> {
  const { config } = loadConfig(cwd)
  const distDir = outDir ?? path.join(cwd, 'dist')

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

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  fs.copyFileSync(STYLE_PATH, path.join(distDir, 'style.css'))
  const logoSrc = config.logo ? copyLogo(config.logo.image, distDir) : null

  let totalOriginal = 0
  let totalMinified = 0
  const pages = cache.all().filter((p) => p.ok)

  for (const page of pages) {
    if (!page.ok) continue

    const html = renderLayout({
      page,
      navTree: cache.navTree,
      siteName: config.name,
      liveReload: false,
      logoSrc,
    })

    const minified = await minifyHtml(html)
    const origSize = Buffer.byteLength(html)
    const minSize = Buffer.byteLength(minified)
    totalOriginal += origSize
    totalMinified += minSize

    const filePath =
      page.route === '/'
        ? path.join(distDir, 'index.html')
        : path.join(distDir, page.route.slice(1), 'index.html')

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, minified)

    const orig = formatBytes(origSize).padStart(8)
    const min  = formatBytes(minSize).padStart(8)
    const pct  = pctSaved(origSize, minSize).padStart(5)
    console.log(`  ✓ ${page.route.padEnd(24)} ${orig} → ${min}  (${pct})`)
  }

  const origTotal = formatBytes(totalOriginal)
  const minTotal  = formatBytes(totalMinified)
  const pct       = pctSaved(totalOriginal, totalMinified)
  console.log(`\n✓ Built ${pages.length} pages → ${path.relative(cwd, distDir)}/`)
  console.log(`  size: ${origTotal} → ${minTotal}  (${pct} smaller)\n`)
  return distDir
}
