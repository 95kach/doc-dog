import * as fs from 'node:fs'
import * as path from 'node:path'
import { parse } from 'yaml'
import type { SidebarEntry } from '../types.js'

export function loadSidebar(docsDir: string): SidebarEntry[] | null {
  const sidebarPath = path.join(docsDir, 'sidebars.yaml')
  if (!fs.existsSync(sidebarPath)) return null
  const raw = parse(fs.readFileSync(sidebarPath, 'utf-8'))
  if (!Array.isArray(raw)) return null
  return raw as SidebarEntry[]
}

/** Convert a sidebars.yaml page path to a URL route */
export function pageToRoute(page: string): string {
  const withoutExt = page.replace(/\.md$/, '')
  if (withoutExt === 'index') return '/'
  if (withoutExt.endsWith('/index')) return '/' + withoutExt.slice(0, -'/index'.length)
  return '/' + withoutExt
}
