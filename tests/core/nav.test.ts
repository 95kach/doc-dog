import { describe, it, expect } from 'vitest'
import { buildNavTree } from '../../src/core/nav.js'

describe('buildNavTree', () => {
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
