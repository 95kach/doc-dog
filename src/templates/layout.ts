import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NavItem, PageResult } from '../types.js'

export const STYLE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'style.css')

const STYLESHEET = '<link rel="stylesheet" href="/style.css">'

export function renderLayout(opts: {
  page: PageResult
  navTree: NavItem[]
  siteName: string
  liveReload: boolean
  logoSrc?: string | null
}): string {
  const { page, navTree, siteName, liveReload, logoSrc } = opts
  const content = page.ok ? page.html : renderErrorContent(page.error)
  const activeRoute = page.route

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(siteName)}</title>
  ${STYLESHEET}
</head>
<body>
  <nav class="navbar">
    <a href="/" class="navbar-brand">
      ${logoSrc ? `<img src="${logoSrc}" alt="${escHtml(siteName)}" class="navbar-logo">` : escHtml(siteName)}
    </a>
  </nav>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-section">
        ${renderNavTree(navTree, activeRoute)}
      </div>
    </aside>
    <main class="content">
      ${content}
    </main>
  </div>
  ${liveReload ? liveReloadScript() : ''}
</body>
</html>`
}

export function render404(route: string, siteName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>404 — ${escHtml(siteName)}</title>${STYLESHEET}</head>
<body>
  <div class="error-center">
    <div>
      <div class="error-code">404</div>
      <div class="error-message">Page not found</div>
      <div class="error-detail">${escHtml(route)}</div>
      <a href="/" class="btn">← Back to home</a>
    </div>
  </div>
</body>
</html>`
}

export function renderCdnEmpty(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not Deployed</title>${STYLESHEET}</head>
<body>
  <div class="error-center">
    <div>
      <div class="cdn-icon">📦</div>
      <div class="cdn-title">Nothing deployed yet</div>
      <div class="cdn-subtitle">Run <code>npx @docdog/cli deploy</code> first</div>
    </div>
  </div>
</body>
</html>`
}

function renderErrorContent(error: string): string {
  return `<div class="error-page">
    <div class="error-code">500</div>
    <div class="error-message">Render error</div>
    <div class="error-detail">${escHtml(error)}</div>
    <a href="/" class="btn">← Back to home</a>
  </div>`
}

function renderNavTree(items: NavItem[], activeRoute: string): string {
  return items
    .map((item) => {
      if (item.children.length > 0) {
        const children = item.children
          .map(
            (child) =>
              `<div class="child"><a href="${child.href}" class="${child.href === activeRoute ? 'active' : ''}">${escHtml(child.label)}</a></div>`
          )
          .join('')
        return `<div class="group-label">${escHtml(item.label)}</div>${children}`
      }
      return `<a href="${item.href}" class="${item.href === activeRoute ? 'active' : ''}">${escHtml(item.label)}</a>`
    })
    .join('\n')
}

function liveReloadScript(): string {
  return `<div class="live-badge">● live reload</div>
<script>
  const es = new EventSource('/sse');
  es.onmessage = () => { es.close(); location.reload(); };
</script>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
