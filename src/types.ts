export type PageResult =
  | { ok: true;  route: string; filePath: string; html: string; frontmatter: Record<string, unknown> }
  | { ok: false; route: string; filePath: string; error: string }

export type NavItem = {
  label: string
  href: string
  children: NavItem[]
}

export type Config = {
  name: string     // shown in top-left navbar
  docsDir: string  // absolute path, resolved from CWD
  logo?: { image: string }  // absolute path to logo image file
  customCss?: string  // absolute path to custom CSS file
  openApiDir?: string // absolute path to directory of OpenAPI specs
}

export type Runtime = {
  port: number     // default 3000
  cdnPort: number  // default 3100 (LOCAL_CDN_PORT)
  cdnDir: string   // absolute path (LOCAL_CDN_DIR)
}

export type FileEntry = { filePath: string; route: string }

export type SidebarEntry = { page?: string; route?: string; label?: string }

export type ApiParam = {
  name: string
  in: string       // path, query, header
  type: string
  required: boolean
  description: string
}

export type ApiProperty = {
  name: string     // dot notation for nested: "config.retries"
  type: string
  required: boolean
  description: string
}

export type ApiResponse = {
  status: string
  description: string
  properties: ApiProperty[]
}

export type ParsedOperation = {
  route: string
  method: string       // lowercase: get, post, put, delete, patch
  path: string         // /jobs/{id}
  summary: string
  description: string
  parameters: ApiParam[]
  requestBody: { description: string; required: boolean; properties: ApiProperty[] } | null
  responses: ApiResponse[]
  baseUrl: string
  specName: string
  filePath: string     // source spec file path
}
