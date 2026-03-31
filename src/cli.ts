#!/usr/bin/env node
import { program } from 'commander'
import { preview } from './commands/preview.js'
import { build } from './commands/build.js'
import { deploy } from './commands/deploy.js'

program
  .name('docdog')
  .description('Markdown documentation site generator')
  .version('0.1.0')

program
  .command('preview')
  .description('Start development server with live reload')
  .action(async () => {
    try {
      await preview(process.cwd())
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('build')
  .description('Build static HTML output to dist/')
  .action(async () => {
    try {
      await build(process.cwd())
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('deploy')
  .description('Build, copy to cdn/, and start simulated CDN server')
  .action(async () => {
    try {
      await deploy(process.cwd())
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program.parse()
