import * as path from 'node:path'
import type { NavItem, SidebarEntry } from '../types.js'
import { pageToRoute } from './sidebar.js'

export function buildNavTree(routes: string[], sidebar?: SidebarEntry[] | null): NavItem[] {
  if (sidebar && sidebar.length > 0) {
    return buildFromSidebar(routes, sidebar)
  }
  return buildAuto(routes)
}

function buildFromSidebar(routes: string[], sidebar: SidebarEntry[]): NavItem[] {
  const routeSet = new Set(routes)
  return sidebar
    .map((entry): NavItem | null => {
      const route = pageToRoute(entry.page)
      if (!routeSet.has(route)) return null
      const label = entry.label ?? deriveLabel(entry.page)
      return { label, href: route, children: [] }
    })
    .filter((item): item is NavItem => item !== null)
}

function buildAuto(routes: string[]): NavItem[] {
  const items: NavItem[] = []
  const groups = new Map<string, NavItem>()

  for (const route of [...new Set(routes)].sort()) {
    if (route === '/') {
      items.unshift({ label: 'Home', href: '/', children: [] })
      continue
    }

    const parts = route.split('/').filter(Boolean)

    if (parts.length === 1) {
      items.push({ label: toLabel(parts[0]), href: route, children: [] })
    } else {
      const groupKey = '/' + parts.slice(0, -1).join('/')
      if (!groups.has(groupKey)) {
        const group: NavItem = {
          label: toLabel(parts[0]),
          href: groupKey,
          children: [],
        }
        groups.set(groupKey, group)
        items.push(group)
      }
      groups.get(groupKey)!.children.push({
        label: toLabel(parts[parts.length - 1]),
        href: route,
        children: [],
      })
    }
  }

  return items
}

function deriveLabel(page: string): string {
  const base = path.basename(page, '.md')
  // For index files, use the parent directory name
  if (base === 'index') {
    const dir = path.dirname(page)
    return dir === '.' ? 'Home' : toLabel(path.basename(dir))
  }
  return toLabel(base)
}

function toLabel(slug: string): string {
  const spaced = slug.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
