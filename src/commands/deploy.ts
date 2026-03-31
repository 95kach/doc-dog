import * as fs from 'node:fs'
import { loadConfig } from '../core/config.js'
import { build } from './build.js'
import { createStaticServer } from '../server/static-server.js'
import { findFreePort } from '../server/dev-server.js'

export async function deploy(cwd: string = process.cwd()): Promise<void> {
  const { runtime } = loadConfig(cwd)

  console.log('Deploying...\n')
  const distDir = await build(cwd)

  console.log(`\nCopying to ${runtime.cdnDir} ...`)
  fs.rmSync(runtime.cdnDir, { recursive: true, force: true })
  fs.cpSync(distDir, runtime.cdnDir, { recursive: true })
  console.log('  ✓ Files copied')

  console.log('\nStarting CDN server...')
  const app = await createStaticServer(runtime.cdnDir)
  const port = await findFreePort(runtime.cdnPort)
  await app.listen({ port, host: '127.0.0.1' })

  console.log(`\n🚀 Deployed at http://localhost:${port}`)
  console.log('   (separate process — preview on a different port will not conflict)\n')
}
