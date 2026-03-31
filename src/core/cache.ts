import type { PageResult, NavItem, FileEntry } from '../types.js'
import { renderFile } from './renderer.js'
import { buildNavTree } from './nav.js'

export class PageCache {
  private pages = new Map<string, PageResult>()
  private fileToRoute = new Map<string, string>()
  public navTree: NavItem[] = []

  async build(entries: FileEntry[]): Promise<void> {
    for (const { filePath, route } of entries) {
      this.fileToRoute.set(filePath, route)
      this.pages.set(route, renderFile(filePath, route))
    }
    this.rebuildNav()
  }

  get(route: string): PageResult | undefined {
    return this.pages.get(route)
  }

  set(route: string, page: PageResult): void {
    this.pages.set(route, page)
    this.fileToRoute.set(page.filePath, route)
  }

  update(filePath: string, route: string): PageResult {
    const result = renderFile(filePath, route)
    this.pages.set(route, result)
    this.fileToRoute.set(filePath, route)
    return result
  }

  remove(route: string): void {
    const page = this.pages.get(route)
    if (page) this.fileToRoute.delete(page.filePath)
    this.pages.delete(route)
    this.rebuildNav()
  }

  rebuildNav(): void {
    this.navTree = buildNavTree([...this.pages.keys()])
  }

  getRouteForFile(filePath: string): string | undefined {
    return this.fileToRoute.get(filePath)
  }

  all(): PageResult[] {
    return [...this.pages.values()]
  }

  getFailures(): Array<PageResult & { ok: false }> {
    return this.all().filter((p): p is PageResult & { ok: false } => !p.ok)
  }
}
