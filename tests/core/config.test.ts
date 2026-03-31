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

  it('loads valid YAML config with name and docsDir', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test Site\ndocsDir: ./docs\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.name).toBe('Test Site')
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('uses default docsDir when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.docsDir).toBe(path.resolve(tmpDir, './docs'))
  })

  it('reads PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    process.env.PORT = '4000'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.port).toBe(4000)
  })

  it('reads LOCAL_CDN_PORT from environment', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    process.env.LOCAL_CDN_PORT = '4100'
    const { runtime } = loadConfig(tmpDir)
    expect(runtime.cdnPort).toBe(4100)
  })

  it('throws ZodError when name is missing', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'docsDir: ./docs\n'
    )
    expect(() => loadConfig(tmpDir)).toThrow()
  })

  it('throws when docdog.yaml is missing', () => {
    expect(() => loadConfig(tmpDir)).toThrow(/docdog\.yaml/)
  })

  it('resolves customCss to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\ncustomCss: ./theme.css\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.customCss).toBe(path.resolve(tmpDir, './theme.css'))
  })

  it('omits customCss when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.customCss).toBeUndefined()
  })

  it('resolves logo.image to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\nlogo:\n  image: ./logo.svg\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.logo?.image).toBe(path.resolve(tmpDir, './logo.svg'))
  })

  it('resolves openApiDir to absolute path', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\nopenApiDir: ./api\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.openApiDir).toBe(path.resolve(tmpDir, './api'))
  })

  it('omits openApiDir when not specified', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'docdog.yaml'),
      'name: Test\n'
    )
    const { config } = loadConfig(tmpDir)
    expect(config.openApiDir).toBeUndefined()
  })
})
