import * as fs from 'node:fs'
import * as path from 'node:path'
import type { FileEntry } from '../types.js'

export function discoverFiles(docsDir: string): FileEntry[] {
  if (!fs.existsSync(docsDir)) {
    throw new Error(`docs directory not found: ${docsDir}`)
  }
  const entries: FileEntry[] = []

  function walk(dir: string) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item)
      if (fs.statSync(full).isDirectory()) {
        walk(full)
      } else if (item.endsWith('.md')) {
        entries.push({ filePath: full, route: filePathToRoute(docsDir, full) })
      }
    }
  }

  walk(docsDir)
  return entries
}

export function filePathToRoute(docsDir: string, filePath: string): string {
  const relative = path.relative(docsDir, filePath).replace(/\\/g, '/')
  const withoutExt = relative.replace(/\.md$/, '')
  if (withoutExt === 'index') return '/'
  if (withoutExt.endsWith('/index')) return '/' + withoutExt.slice(0, -'/index'.length)
  return `/${withoutExt}`
}
