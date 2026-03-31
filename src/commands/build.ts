import * as fs from 'node:fs'
import * as path from 'node:path'
import { loadConfig } from '../core/config.js'
import { discoverFiles } from '../core/discover.js'
import { PageCache } from '../core/cache.js'
import { renderLayout } from '../templates/layout.js'
import { buildCss } from '../core/css.js'
import { minifyHtml, minifyCss, formatBytes, pctSaved } from '../core/minify.js'
import { discoverOpenApiSpecs } from '../core/discover-openapi.js'
import { renderOpenApiOperation } from '../core/render-openapi.js'

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

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  // Minify and write style.css (default + custom overrides)
  const rawCss = buildCss(config.customCss)
  const minCss = await minifyCss(rawCss)
  fs.writeFileSync(path.join(distDir, 'style.css'), minCss)

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

  // Static assets
  const cssOrig = Buffer.byteLength(rawCss)
  const cssMin  = Buffer.byteLength(minCss)
  const cssLine = `${'style.css'.padEnd(24)} ${formatBytes(cssOrig).padStart(8)} → ${formatBytes(cssMin).padStart(8)}  (${pctSaved(cssOrig, cssMin).padStart(5)})`
  console.log(`  ✓ ${cssLine}`)

  if (config.logo) {
    const logoFile = config.logo.image
    if (fs.existsSync(logoFile)) {
      const logoSize = fs.statSync(logoFile).size
      const ext = path.extname(logoFile).slice(1)
      console.log(`  ✓ ${'__logo.' + ext}`)
    }
  }

  const allOrig = totalOriginal + cssOrig
  const allMin  = totalMinified + cssMin
  console.log(`\n✓ Built ${pages.length} pages → ${path.relative(cwd, distDir)}/`)
  console.log(`  size: ${formatBytes(allOrig)} → ${formatBytes(allMin)}  (${pctSaved(allOrig, allMin)} smaller)\n`)
  return distDir
}
