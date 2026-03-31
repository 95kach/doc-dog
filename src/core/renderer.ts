import Markdoc from '@markdoc/markdoc'
import * as fs from 'node:fs'
import type { PageResult } from '../types.js'

export function renderFile(filePath: string, route: string): PageResult {
  try {
    const source = fs.readFileSync(filePath, 'utf-8')
    const ast = Markdoc.parse(source)
    const content = Markdoc.transform(ast)
    const html = Markdoc.renderers.html(content)
    const frontmatter = parseFrontmatter(
      (ast.attributes?.frontmatter as string) ?? ''
    )
    return { ok: true, route, filePath, html, frontmatter }
  } catch (err) {
    return { ok: false, route, filePath, error: err instanceof Error ? err.message : String(err) }
  }
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {}
  try {
    return Object.fromEntries(
      raw
        .split('\n')
        .filter((line) => line.includes(':'))
        .map((line) => {
          const [k, ...v] = line.split(':')
          return [k.trim(), v.join(':').trim()]
        })
    )
  } catch {
    return {}
  }
}
