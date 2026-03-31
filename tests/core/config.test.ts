import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { loadConfig } from '../../src/core/config.js'

describe('loadConfig', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-'))
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
    delete process.env.PORT
    delete process.env.LOCAL_CDN_PORT
    delete process.env.LOCAL_CDN_DIR
  })

  it('loads valid config with name and docsDir', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ name: 'Test Site', docsDir: './docs' })
    )
    const { config } = loadConfig(tmpDir)
    expect(config.name).toBe('Test Site')
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('uses default docsDir when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ name: 'Test' })
    )
    const { config } = loadConfig(tmpDir)
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('reads PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ name: 'Test' })
    )
    process.env.PORT = '4000'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.port).toBe(4000)
  })

  it('reads LOCAL_CDN_PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ name: 'Test' })
    )
    process.env.LOCAL_CDN_PORT = '4100'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.cdnPort).toBe(4100)
  })

  it('throws ZodError when name is missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.config.json'),
      JSON.stringify({ docsDir: './docs' })
    )
    expect(() => loadConfig(tmpDir)).toThrow()
  })

  it('throws when docdog.config.json is missing', () => {
    expect(() => loadConfig(tmpDir)).toThrow(/docdog.config.json/)
  })
})
