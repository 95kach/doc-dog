import * as fs from 'node:fs'
import { STYLE_PATH } from '../templates/layout.js'

export function buildCss(customCssPath?: string): string {
  const defaultCss = fs.readFileSync(STYLE_PATH, 'utf-8')

  if (!customCssPath) return defaultCss

  if (!fs.existsSync(customCssPath)) {
    console.warn(`  ⚠  custom CSS not found: ${customCssPath}`)
    return defaultCss
  }

  const customCss = fs.readFileSync(customCssPath, 'utf-8')
  if (!customCss.trim()) return defaultCss

  return defaultCss + '\n/* custom overrides */\n' + customCss
}
