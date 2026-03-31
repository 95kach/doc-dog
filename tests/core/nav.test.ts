import { describe, it, expect } from 'vitest'
import { buildNavTree } from '../../src/core/nav.js'

describe('buildNavTree (auto)', () => {
  it('puts / as Home at the top', () => {
    const tree = buildNavTree(['/'])
    expect(tree[0]).toEqual({ label: 'Home', href: '/', children: [] })
  })

  it('capitalizes top-level page label', () => {
    const tree = buildNavTree(['/submit'])
    expect(tree[0].label).toBe('Submit')
    expect(tree[0].href).toBe('/submit')
  })

  it('nests children under a group for two-segment routes', () => {
    const tree = buildNavTree(['/jobs/status'])
    const group = tree.find((n) => n.label === 'Jobs')
    expect(group).toBeDefined()
    expect(group?.children).toHaveLength(1)
    expect(group?.children[0].href).toBe('/jobs/status')
    expect(group?.children[0].label).toBe('Status')
  })

  it('places Home first when mixed routes provided', () => {
    const tree = buildNavTree(['/submit', '/', '/jobs/status'])
    expect(tree[0].href).toBe('/')
  })

  it('converts hyphens to spaces in labels', () => {
    const tree = buildNavTree(['/getting-started'])
    expect(tree[0].label).toBe('Getting started')
  })
})

describe('buildNavTree (sidebar)', () => {
  it('uses sidebar order and labels', () => {
    const routes = ['/', '/jobs', '/jobs/[:id]']
    const sidebar = [
      { page: 'index.md', label: 'Start here' },
      { page: 'jobs/index.md', label: 'Jobs' },
      { page: 'jobs/[:id]/index.md', label: 'Job Status' },
    ]
    const tree = buildNavTree(routes, sidebar)
    expect(tree).toHaveLength(3)
    expect(tree[0]).toEqual({ label: 'Start here', href: '/', children: [] })
    expect(tree[1]).toEqual({ label: 'Jobs', href: '/jobs', children: [] })
    expect(tree[2]).toEqual({ label: 'Job Status', href: '/jobs/[:id]', children: [] })
  })

  it('skips sidebar entries whose route is not in the cache', () => {
    const routes = ['/', '/jobs']
    const sidebar = [
      { page: 'index.md', label: 'Start here' },
      { page: 'jobs/index.md', label: 'Jobs' },
      { page: 'jobs/[:id]/index.md', label: 'Job Status' }, // not in cache
    ]
    const tree = buildNavTree(routes, sidebar)
    expect(tree).toHaveLength(2)
  })

  it('derives label from page filename when label omitted', () => {
    const routes = ['/jobs']
    const sidebar = [{ page: 'jobs/index.md' }]
    const tree = buildNavTree(routes, sidebar)
    expect(tree[0].label).toBe('Jobs')
  })

  it('falls back to auto when sidebar is null', () => {
    const tree = buildNavTree(['/'], null)
    expect(tree[0].label).toBe('Home')
  })
})
