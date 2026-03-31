import { describe, it, expect } from 'vitest'
import { renderOpenApiOperation } from '../../src/core/render-openapi.js'
import type { ParsedOperation } from '../../src/types.js'

function makeOp(overrides: Partial<ParsedOperation> = {}): ParsedOperation {
  return {
    route: '/get-jobs',
    method: 'get',
    path: '/jobs',
    summary: 'List jobs',
    description: 'Returns all jobs.',
    parameters: [],
    requestBody: null,
    responses: [],
    baseUrl: 'https://api.example.com',
    specName: 'test',
    filePath: '/tmp/test.yaml',
    ...overrides,
  }
}

describe('renderOpenApiOperation', () => {
  it('renders method badge with correct class', () => {
    const html = renderOpenApiOperation(makeOp({ method: 'post' }))
    expect(html).toContain('api-method--post')
    expect(html).toContain('POST')
  })

  it('renders path with highlighted parameters', () => {
    const html = renderOpenApiOperation(makeOp({ path: '/jobs/{id}' }))
    expect(html).toContain('api-param')
    expect(html).toContain('{id}')
  })

  it('renders summary as h1', () => {
    const html = renderOpenApiOperation(makeOp({ summary: 'List jobs' }))
    expect(html).toContain('<h1>List jobs</h1>')
  })

  it('renders description as paragraph', () => {
    const html = renderOpenApiOperation(makeOp({ description: 'Returns all jobs.' }))
    expect(html).toContain('<p>Returns all jobs.</p>')
  })

  it('renders parameters table', () => {
    const html = renderOpenApiOperation(makeOp({
      parameters: [
        { name: 'limit', in: 'query', type: 'integer', required: false, description: 'Max results' },
        { name: 'id', in: 'path', type: 'string', required: true, description: 'Job ID' },
      ],
    }))
    expect(html).toContain('Parameters')
    expect(html).toContain('limit')
    expect(html).toContain('query')
    expect(html).toContain('id')
    expect(html).toContain('path')
  })

  it('renders request body table', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      requestBody: {
        description: 'Job data',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: 'URL to process' },
          { name: 'config', type: 'object', required: false, description: 'Configuration' },
          { name: 'config.retries', type: 'integer', required: false, description: 'Retry count' },
        ],
      },
    }))
    expect(html).toContain('Request Body')
    expect(html).toContain('url')
    expect(html).toContain('config.retries')
  })

  it('renders response schemas grouped by status', () => {
    const html = renderOpenApiOperation(makeOp({
      responses: [
        { status: '200', description: 'OK', properties: [{ name: 'id', type: 'string', required: true, description: 'Job ID' }] },
        { status: '404', description: 'Not Found', properties: [{ name: 'error', type: 'string', required: false, description: 'Error message' }] },
      ],
    }))
    expect(html).toContain('200')
    expect(html).toContain('OK')
    expect(html).toContain('404')
    expect(html).toContain('Not Found')
  })

  it('renders curl example', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'get',
      path: '/jobs/{id}',
      baseUrl: 'https://api.example.com',
    }))
    expect(html).toContain('curl')
    expect(html).toContain('https://api.example.com/jobs/{id}')
  })

  it('renders fetch example', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'get',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
    }))
    expect(html).toContain('fetch')
    expect(html).toContain('https://api.example.com/jobs')
  })

  it('renders POST curl with body', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
      requestBody: {
        description: '',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: '' },
        ],
      },
    }))
    expect(html).toContain('-X POST')
    expect(html).toContain('Content-Type: application/json')
  })

  it('renders POST fetch with body', () => {
    const html = renderOpenApiOperation(makeOp({
      method: 'post',
      path: '/jobs',
      baseUrl: 'https://api.example.com',
      requestBody: {
        description: '',
        required: true,
        properties: [
          { name: 'url', type: 'string', required: true, description: '' },
        ],
      },
    }))
    expect(html).toContain("method: 'POST'")
    expect(html).toContain('body: JSON.stringify')
  })

  it('skips parameters section when empty', () => {
    const html = renderOpenApiOperation(makeOp({ parameters: [] }))
    expect(html).not.toContain('Parameters')
  })

  it('skips request body section when null', () => {
    const html = renderOpenApiOperation(makeOp({ requestBody: null }))
    expect(html).not.toContain('Request Body')
  })

  it('escapes HTML in strings', () => {
    const html = renderOpenApiOperation(makeOp({ summary: 'Get <script>alert(1)</script>' }))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
