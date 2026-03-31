import type { ParsedOperation, ApiParam, ApiProperty, ApiResponse } from '../types.js'

export function renderOpenApiOperation(op: ParsedOperation): string {
  const parts: string[] = []

  // 1. Method badge + path
  parts.push(`<div class="api-endpoint">
  <span class="api-method api-method--${op.method}">${op.method.toUpperCase()}</span>
  <code class="api-path">${highlightParams(op.path)}</code>
</div>`)

  // 2. Description
  if (op.summary) parts.push(`<h1>${esc(op.summary)}</h1>`)
  if (op.description) parts.push(`<p>${esc(op.description)}</p>`)

  // 3. Parameters
  if (op.parameters.length > 0) {
    parts.push(`<h2>Parameters</h2>`)
    parts.push(renderParamsTable(op.parameters))
  }

  // 4. Request body
  if (op.requestBody) {
    parts.push(`<h2>Request Body</h2>`)
    if (op.requestBody.description) parts.push(`<p>${esc(op.requestBody.description)}</p>`)
    parts.push(renderPropsTable(op.requestBody.properties, true))
  }

  // 5. Responses
  if (op.responses.length > 0) {
    parts.push(`<h2>Responses</h2>`)
    for (const resp of op.responses) {
      parts.push(`<h3>${esc(resp.status)} ${esc(resp.description)}</h3>`)
      if (resp.properties.length > 0) {
        parts.push(renderPropsTable(resp.properties, false))
      }
    }
  }

  // 6. Examples
  parts.push(`<h2>Examples</h2>`)
  parts.push(renderExamples(op))

  return parts.join('\n')
}

function highlightParams(apiPath: string): string {
  return esc(apiPath).replace(/\{([^}]+)\}/g, '<span class="api-param">{$1}</span>')
}

function renderParamsTable(params: ApiParam[]): string {
  const rows = params.map(p =>
    `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.in)}</td><td><code>${esc(p.type)}</code></td><td>${p.required ? 'yes' : 'no'}</td><td>${esc(p.description)}</td></tr>`
  ).join('\n')
  return `<table class="api-params-table">
<thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function renderPropsTable(props: ApiProperty[], showRequired: boolean): string {
  if (showRequired) {
    const rows = props.map(p =>
      `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(p.type)}</code></td><td>${p.required ? 'yes' : 'no'}</td><td>${esc(p.description)}</td></tr>`
    ).join('\n')
    return `<table class="api-schema-table">
<thead><tr><th>Property</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
  }
  const rows = props.map(p =>
    `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(p.type)}</code></td><td>${esc(p.description)}</td></tr>`
  ).join('\n')
  return `<table class="api-schema-table">
<thead><tr><th>Property</th><th>Type</th><th>Description</th></tr></thead>
<tbody>${rows}</tbody>
</table>`
}

function renderExamples(op: ParsedOperation): string {
  const url = `${op.baseUrl}${op.path}`
  const method = op.method.toUpperCase()
  const parts: string[] = []

  if (op.requestBody && op.requestBody.properties.length > 0) {
    const body = buildSampleBody(op.requestBody.properties)
    const bodyJson = JSON.stringify(body, null, 2)

    parts.push(`<pre><code>curl -X ${method} ${esc(url)} \\
  -H "Content-Type: application/json" \\
  -d '${esc(bodyJson)}'</code></pre>`)

    parts.push(`<pre><code>fetch('${esc(url)}', {
  method: '${method}',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${esc(bodyJson)})
}).then(res =&gt; res.json())</code></pre>`)
  } else {
    parts.push(`<pre><code>curl -X ${method} ${esc(url)}</code></pre>`)

    parts.push(`<pre><code>fetch('${esc(url)}')
  .then(res =&gt; res.json())</code></pre>`)
  }

  return parts.join('\n')
}

function buildSampleBody(props: ApiProperty[]): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const p of props) {
    if (p.name.includes('.')) continue // skip nested (parent already creates object)
    body[p.name] = sampleValue(p.type)
  }
  return body
}

function sampleValue(type: string): unknown {
  switch (type) {
    case 'string': return 'string'
    case 'integer': return 0
    case 'number': return 0
    case 'boolean': return true
    case 'array': return []
    case 'object': return {}
    default: return 'string'
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
