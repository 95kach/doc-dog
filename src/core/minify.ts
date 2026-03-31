import { minify } from 'html-minifier-terser'

export async function minifyHtml(html: string): Promise<string> {
  return minify(html, {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  })
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

export function pctSaved(original: number, minified: number): string {
  return `-${Math.round((1 - minified / original) * 100)}%`
}
