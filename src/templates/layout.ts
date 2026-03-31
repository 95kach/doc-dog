import type { NavItem, PageResult } from '../types.js'

export function renderLayout(opts: {
  page: PageResult
  navTree: NavItem[]
  siteName: string
  liveReload: boolean
}): string {
  const { page, navTree, siteName, liveReload } = opts
  const content = page.ok ? page.html : renderErrorContent(page.error)
  const activeRoute = page.route

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(siteName)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;flex-direction:column;min-height:100vh}
    .navbar{background:#1a1f2e;border-bottom:1px solid #30363d;padding:0 20px;height:48px;display:flex;align-items:center;flex-shrink:0}
    .navbar-brand{color:#e6edf3;font-weight:600;font-size:15px;text-decoration:none}
    .layout{display:flex;flex:1}
    .sidebar{width:240px;background:#161b22;border-right:1px solid #30363d;padding:16px 0;flex-shrink:0;overflow-y:auto}
    .sidebar-section{padding:0 8px}
    .sidebar a{display:block;padding:6px 8px;color:#c9d1d9;text-decoration:none;border-radius:4px;font-size:13px}
    .sidebar a:hover{background:#21262d}
    .sidebar a.active{background:#21262d;color:#58a6ff}
    .group-label{padding:8px 8px 4px;font-size:11px;font-weight:600;color:#8b949e;text-transform:uppercase;letter-spacing:.08em}
    .child a{padding-left:20px}
    .content{flex:1;padding:40px;max-width:860px}
    .content h1{color:#e6edf3;margin-bottom:16px}
    .content h2{color:#e6edf3;margin:24px 0 12px}
    .content h3{color:#e6edf3;margin:20px 0 8px}
    .content p{line-height:1.7;margin-bottom:12px}
    .content code{background:#21262d;padding:2px 6px;border-radius:3px;font-size:13px}
    .content pre{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:16px;overflow-x:auto;margin:12px 0}
    .content pre code{background:none;padding:0}
    .content ul,.content ol{padding-left:20px;margin-bottom:12px}
    .content li{line-height:1.7}
    .content table{border-collapse:collapse;width:100%;margin-bottom:12px}
    .content th,.content td{border:1px solid #30363d;padding:8px 12px;text-align:left;font-size:13px}
    .content th{background:#161b22;color:#e6edf3}
    .error-page{text-align:center;padding:80px 40px}
    .error-code{font-size:72px;font-weight:800;color:#30363d;font-family:monospace}
    .error-message{color:#e6edf3;font-size:18px;margin:12px 0}
    .error-detail{color:#8b949e;font-size:13px;font-family:monospace;margin:8px 0 24px;word-break:break-all}
    .btn{display:inline-block;background:#21262d;border:1px solid #30363d;color:#58a6ff;padding:8px 20px;border-radius:6px;font-size:14px;text-decoration:none}
    .live-badge{position:fixed;bottom:16px;right:16px;background:#21262d;border:1px solid #30363d;padding:4px 12px;border-radius:20px;font-size:11px;color:#3fb950}
  </style>
</head>
<body>
  <nav class="navbar">
    <a href="/" class="navbar-brand">${escHtml(siteName)}</a>
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
<head><meta charset="UTF-8"><title>404 — ${escHtml(siteName)}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
  .error-code{font-size:72px;font-weight:800;color:#30363d;font-family:monospace}
  .error-message{color:#e6edf3;font-size:18px;margin:12px 0}
  .error-detail{color:#8b949e;font-size:13px;font-family:monospace;margin:8px 0 24px}
  .btn{display:inline-block;background:#21262d;border:1px solid #30363d;color:#58a6ff;padding:8px 20px;border-radius:6px;font-size:14px;text-decoration:none}
</style>
</head>
<body>
  <div>
    <div class="error-code">404</div>
    <div class="error-message">Page not found</div>
    <div class="error-detail">${escHtml(route)}</div>
    <a href="/" class="btn">← Back to home</a>
  </div>
</body>
</html>`
}

export function renderCdnEmpty(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Not Deployed</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
  .icon{font-size:48px;margin-bottom:16px}
  .title{color:#e6edf3;font-size:20px;margin-bottom:8px}
  .subtitle{color:#8b949e;font-size:14px;margin-bottom:16px}
  code{background:#21262d;padding:4px 10px;border-radius:4px;font-size:13px}
</style>
</head>
<body>
  <div>
    <div class="icon">📦</div>
    <div class="title">Nothing deployed yet</div>
    <div class="subtitle">Run <code>npx @docdog/cli deploy</code> first</div>
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
  es.onmessage = () => location.reload();
  es.onerror = () => es.close();
</script>`
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
