import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { renderFile } from '../../src/core/renderer.js'

describe('renderFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('returns ok:true with html for valid markdown', () => {
    const filePath = path.join(tmpDir, 'test.md')
    fs.writeFileSync(filePath, '# Hello\n\nWorld paragraph.')
    const result = renderFile(filePath, '/test')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.html).toContain('Hello')
      expect(result.html).toContain('World paragraph')
    }
  })

  it('returns the correct route and filePath', () => {
    const filePath = path.join(tmpDir, 'test.md')
    fs.writeFileSync(filePath, '# Hello')
    const result = renderFile(filePath, '/test')
    expect(result.route).toBe('/test')
    expect(result.filePath).toBe(filePath)
  })

  it('returns ok:false when file does not exist', () => {
    const result = renderFile('/nonexistent/missing.md', '/missing')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
    }
  })

  it('returns ok:true with empty frontmatter when none present', () => {
    const filePath = path.join(tmpDir, 'test.md')
    fs.writeFileSync(filePath, '# No frontmatter')
    const result = renderFile(filePath, '/test')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.frontmatter).toEqual({})
    }
  })
})
