import * as fs from 'node:fs'
import * as path from 'node:path'
import SwaggerParser from '@apidevtools/swagger-parser'
import type { OpenAPIV3 } from 'openapi-types'
import type { ParsedOperation, ApiParam, ApiProperty, ApiResponse } from '../types.js'

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const

export function operationToRoute(specName: string, method: string, apiPath: string, singleSpec: boolean): string {
  const normalized = apiPath
    .replace(/^\//, '')
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\//g, '-')
  const segment = `${method}-${normalized}`
  return singleSpec ? `/${segment}` : `/${specName}/${segment}`
}

export async function discoverOpenApiSpecs(openApiDir: string): Promise<ParsedOperation[]> {
  if (!fs.existsSync(openApiDir)) return []

  const files = fs.readdirSync(openApiDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'))
  const specFiles: Array<{ filePath: string; name: string }> = []

  for (const file of files) {
    const filePath = path.join(openApiDir, file)
    try {
      const doc = await SwaggerParser.dereference(filePath) as OpenAPIV3.Document
      if (doc.openapi && doc.openapi.startsWith('3.')) {
        specFiles.push({ filePath, name: path.basename(file, path.extname(file)) })
      }
    } catch {
      // Not a valid OpenAPI spec, skip
    }
  }

  const singleSpec = specFiles.length === 1
  const allOps: ParsedOperation[] = []

  for (const { filePath, name } of specFiles) {
    const doc = await SwaggerParser.dereference(filePath) as OpenAPIV3.Document
    const baseUrl = doc.servers?.[0]?.url ?? ''

    for (const [apiPath, pathItem] of Object.entries(doc.paths ?? {})) {
      for (const method of HTTP_METHODS) {
        const op = (pathItem as OpenAPIV3.PathItemObject)?.[method]
        if (!op) continue

        allOps.push({
          route: operationToRoute(name, method, apiPath, singleSpec),
          method,
          path: apiPath,
          summary: op.summary ?? '',
          description: op.description ?? '',
          parameters: extractParams(op),
          requestBody: extractRequestBody(op),
          responses: extractResponses(op),
          baseUrl,
          specName: name,
          filePath,
        })
      }
    }
  }

  return allOps
}

function extractParams(op: OpenAPIV3.OperationObject): ApiParam[] {
  return (op.parameters ?? []).map(p => {
    const param = p as OpenAPIV3.ParameterObject
    const schema = param.schema as OpenAPIV3.SchemaObject | undefined
    return {
      name: param.name,
      in: param.in,
      type: schema?.type ?? 'string',
      required: param.required ?? false,
      description: param.description ?? '',
    }
  })
}

function extractRequestBody(op: OpenAPIV3.OperationObject): ParsedOperation['requestBody'] {
  const body = op.requestBody as OpenAPIV3.RequestBodyObject | undefined
  if (!body) return null

  const content = body.content?.['application/json']
  const schema = content?.schema as OpenAPIV3.SchemaObject | undefined

  return {
    description: body.description ?? '',
    required: body.required ?? false,
    properties: schema ? flattenProperties(schema) : [],
  }
}

function extractResponses(op: OpenAPIV3.OperationObject): ApiResponse[] {
  return Object.entries(op.responses ?? {}).map(([status, resp]) => {
    const response = resp as OpenAPIV3.ResponseObject
    const content = response.content?.['application/json']
    const schema = content?.schema as OpenAPIV3.SchemaObject | undefined

    return {
      status,
      description: response.description ?? '',
      properties: schema ? flattenProperties(schema) : [],
    }
  })
}

function flattenProperties(schema: OpenAPIV3.SchemaObject, prefix = ''): ApiProperty[] {
  const props: ApiProperty[] = []
  const required = new Set(schema.required ?? [])

  for (const [name, propRef] of Object.entries(schema.properties ?? {})) {
    const prop = propRef as OpenAPIV3.SchemaObject
    const fullName = prefix ? `${prefix}.${name}` : name
    props.push({
      name: fullName,
      type: prop.type ?? 'object',
      required: required.has(name),
      description: prop.description ?? '',
    })
    if (prop.type === 'object' && prop.properties) {
      props.push(...flattenProperties(prop, fullName))
    }
  }

  return props
}
