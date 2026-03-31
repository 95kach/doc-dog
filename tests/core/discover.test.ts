import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { discoverFiles, filePathToRoute } from '../../src/core/discover.js'

describe('discoverFiles', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
    fs.mkdirSync(path.join(tmpDir, 'jobs'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('maps index.md to route /', () => {
    fs.writeFileSync(path.join(tmpDir, 'index.md'), '# Home')
    const entries = discoverFiles(tmpDir)
    expect(entries).toContainEqual({
      filePath: path.join(tmpDir, 'index.md'),
      route: '/',
    })
  })

  it('maps top-level file to /slug', () => {
    fs.writeFileSync(path.join(tmpDir, 'submit.md'), '# Submit')
    const entries = discoverFiles(tmpDir)
    expect(entries).toContainEqual({
      filePath: path.join(tmpDir, 'submit.md'),
      route: '/submit',
    })
  })

  it('maps nested file to /parent/slug', () => {
    fs.writeFileSync(path.join(tmpDir, 'jobs', 'status.md'), '# Status')
    const entries = discoverFiles(tmpDir)
    expect(entries).toContainEqual({
      filePath: path.join(tmpDir, 'jobs', 'status.md'),
      route: '/jobs/status',
    })
  })

  it('ignores non-.md files', () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'text')
    const entries = discoverFiles(tmpDir)
    expect(entries).toHaveLength(0)
  })
})

describe('filePathToRoute', () => {
  it('converts index.md to /', () => {
    expect(filePathToRoute('/docs', '/docs/index.md')).toBe('/')
  })

  it('converts top-level file', () => {
    expect(filePathToRoute('/docs', '/docs/submit.md')).toBe('/submit')
  })

  it('converts nested file', () => {
    expect(filePathToRoute('/docs', '/docs/jobs/status.md')).toBe('/jobs/status')
  })
})
