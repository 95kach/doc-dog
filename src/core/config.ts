import { z } from 'zod'
import * as fs from 'node:fs'
import * as path from 'node:path'
import dotenv from 'dotenv'
import type { Config, Runtime } from '../types.js'

const ConfigSchema = z.object({
  name: z.string(),
  docsDir: z.string().default('./docs'),
  logo: z.object({ image: z.string() }).optional(),
})

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  LOCAL_CDN_PORT: z.coerce.number().default(3100),
  LOCAL_CDN_DIR: z.string().default('../cdn'),
})

export function loadConfig(cwd: string): { config: Config; runtime: Runtime } {
  const envPath = path.join(cwd, '.env')
  const fileEnv = fs.existsSync(envPath)
    ? dotenv.parse(fs.readFileSync(envPath, 'utf-8'))
    : {}
  const mergedEnv = { ...process.env, ...fileEnv }

  const configPath = path.join(cwd, 'docdog.config.json')
  if (!fs.existsSync(configPath)) {
    throw new Error(`docdog.config.json not found in ${cwd}`)
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const parsed = ConfigSchema.parse(raw)
  const env = EnvSchema.parse(mergedEnv)

  return {
    config: {
      name: parsed.name,
      docsDir: path.resolve(cwd, parsed.docsDir),
      logo: parsed.logo ? { image: path.resolve(cwd, parsed.logo.image) } : undefined,
    },
    runtime: {
      port: env.PORT,
      cdnPort: env.LOCAL_CDN_PORT,
      cdnDir: path.resolve(cwd, env.LOCAL_CDN_DIR),
    },
  }
}
