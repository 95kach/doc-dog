import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { discoverOpenApiSpecs, operationToRoute } from '../../src/core/discover-openapi.js'

const MINIMAL_SPEC = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /jobs:
    get:
      summary: List jobs
      description: Returns all jobs.
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
          description: Max results
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
    post:
      summary: Create a job
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - url
              properties:
                url:
                  type: string
                  description: URL to process
      responses:
        '201':
          description: Created
  /jobs/{id}:
    get:
      summary: Get job
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
          description: Job ID
      responses:
        '200':
          description: OK
        '404':
          description: Not Found
`

describe('operationToRoute', () => {
  it('generates route from method and path', () => {
    expect(operationToRoute('api', 'get', '/jobs', false)).toBe('/api/get-jobs')
  })

  it('normalizes path parameters', () => {
    expect(operationToRoute('api', 'get', '/jobs/{id}', false)).toBe('/api/get-jobs-id')
  })

  it('omits spec prefix when singleSpec is true', () => {
    expect(operationToRoute('api', 'get', '/jobs', true)).toBe('/get-jobs')
  })

  it('handles root path', () => {
    expect(operationToRoute('api', 'get', '/', true)).toBe('/get-')
  })

  it('handles deeply nested paths', () => {
    expect(operationToRoute('api', 'get', '/users/{id}/jobs/{jobId}', false))
      .toBe('/api/get-users-id-jobs-jobId')
  })
})

describe('discoverOpenApiSpecs', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdog-openapi-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('discovers and parses a YAML spec file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops.length).toBe(3)
  })

  it('extracts method and path correctly', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')
    expect(getJobs).toBeDefined()
    expect(getJobs!.summary).toBe('List jobs')
  })

  it('extracts parameters', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')!
    expect(getJobs.parameters).toHaveLength(1)
    expect(getJobs.parameters[0].name).toBe('limit')
    expect(getJobs.parameters[0].in).toBe('query')
  })

  it('extracts request body properties', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const postJobs = ops.find(o => o.method === 'post')!
    expect(postJobs.requestBody).not.toBeNull()
    expect(postJobs.requestBody!.required).toBe(true)
    expect(postJobs.requestBody!.properties.length).toBeGreaterThanOrEqual(1)
    expect(postJobs.requestBody!.properties[0].name).toBe('url')
  })

  it('extracts responses', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJob = ops.find(o => o.path === '/jobs/{id}')!
    expect(getJob.responses).toHaveLength(2)
    expect(getJob.responses[0].status).toBe('200')
    expect(getJob.responses[1].status).toBe('404')
  })

  it('generates routes with spec name prefix (single spec)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const getJobs = ops.find(o => o.method === 'get' && o.path === '/jobs')!
    expect(getJobs.route).toBe('/get-jobs')
  })

  it('generates routes with spec name prefix (multiple specs)', async () => {
    fs.writeFileSync(path.join(tmpDir, 'alpha.yaml'), MINIMAL_SPEC)
    fs.writeFileSync(path.join(tmpDir, 'beta.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    const alphaOps = ops.filter(o => o.specName === 'alpha')
    expect(alphaOps[0].route).toMatch(/^\/alpha\//)
  })

  it('extracts baseUrl from servers', async () => {
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops[0].baseUrl).toBe('https://api.example.com')
  })

  it('skips non-OpenAPI files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'readme.yaml'), 'title: Not an API\n')
    fs.writeFileSync(path.join(tmpDir, 'test.yaml'), MINIMAL_SPEC)
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops.length).toBe(3) // only from test.yaml
  })

  it('returns empty array for empty directory', async () => {
    const ops = await discoverOpenApiSpecs(tmpDir)
    expect(ops).toEqual([])
  })
})
