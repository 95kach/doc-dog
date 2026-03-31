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
}

export type Runtime = {
  port: number     // default 3000
  cdnPort: number  // default 3100 (LOCAL_CDN_PORT)
  cdnDir: string   // absolute path (LOCAL_CDN_DIR)
}
