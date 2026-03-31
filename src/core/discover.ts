import * as fs from 'node:fs'
import * as path from 'node:path'

export type FileEntry = { filePath: string; route: string }

export function discoverFiles(docsDir: string): FileEntry[] {
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
  return withoutExt === 'index' ? '/' : `/${withoutExt}`
}
