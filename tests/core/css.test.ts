import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { buildCss } from '../../src/core/css.js'

describe('buildCss', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-css-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('returns default CSS when no customCssPath is provided', () => {
    const css = buildCss()
    expect(css).toContain(':root')
    expect(css).toContain('--accent')
  })

  it('returns default CSS when customCssPath is undefined', () => {
    const css = buildCss(undefined)
    expect(css).toContain(':root')
  })

  it('concatenates custom CSS after default CSS', () => {
    const customPath = path.join(tmpDir, 'custom.css')
    fs.writeFileSync(customPath, ':root { --accent: red; }')
    const css = buildCss(customPath)
    expect(css).toContain('--accent')
    expect(css).toContain(':root { --accent: red; }')
    // Custom CSS should come after default
    const defaultEnd = css.indexOf('--accent-live')
    const customStart = css.indexOf(':root { --accent: red; }')
    expect(customStart).toBeGreaterThan(defaultEnd)
  })

  it('warns and returns default CSS when custom file does not exist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const css = buildCss('/nonexistent/custom.css')
    expect(css).toContain(':root')
    expect(css).not.toContain('custom')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not found'))
    warnSpy.mockRestore()
  })

  it('returns default CSS when custom file is empty', () => {
    const customPath = path.join(tmpDir, 'empty.css')
    fs.writeFileSync(customPath, '')
    const css = buildCss(customPath)
    expect(css).not.toContain('/* custom overrides */')
  })
})
