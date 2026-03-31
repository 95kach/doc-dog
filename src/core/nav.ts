import type { NavItem } from '../types.js'

export function buildNavTree(routes: string[]): NavItem[] {
  const items: NavItem[] = []
  const groups = new Map<string, NavItem>()

  for (const route of [...routes].sort()) {
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
          label: toLabel(parts[parts.length - 2]),
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

function toLabel(slug: string): string {
  const spaced = slug.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
