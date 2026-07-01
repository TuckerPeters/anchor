// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect } from 'vitest'
import { validateWorkState, validateGraph } from '../../../src/main/graph/schema.js'

it('accepts in-progress + substep', () => {
  const r = validateWorkState({
    documentId: 'x', graphVersion: 1, updatedAt: 't', orphans: [],
    nodes: { f3: { status: 'in-progress', substep: 'source-found', note: '', resolution: '', updatedAt: 't', seq: 1 } }
  })
  expect(r.valid).toBe(true)
})

it('accepts done with null substep', () => {
  const r = validateWorkState({
    documentId: 'x', graphVersion: 1, updatedAt: 't', orphans: [],
    nodes: { f3: { status: 'done', substep: null, note: '', resolution: '', updatedAt: 't', seq: 1 } }
  })
  expect(r.valid).toBe(true)
})

it('rejects the old "triage" status', () => {
  const r = validateWorkState({
    documentId: 'x', graphVersion: 1, updatedAt: 't', orphans: [],
    nodes: { f3: { status: 'triage', updatedAt: 't', seq: 1 } }
  })
  expect(r.valid).toBe(false)
})

it('accepts a minimal valid graph', () => {
  const r = validateGraph({
    documentId: 'x', graphVersion: 1, stats: {},
    nodes: { pages: [{ id: 'p1' }], claims: [], footnotes: [], sources: [], targets: [] },
    edges: []
  })
  expect(r.valid).toBe(true)
})

it('rejects a bad anchor state', () => {
  const r = validateGraph({
    documentId: 'x', graphVersion: 1, stats: {},
    nodes: { pages: [], claims: [{ id: 'c-1', anchor: { state: 'wobbly' } }], footnotes: [], sources: [], targets: [] },
    edges: []
  })
  expect(r.valid).toBe(false)
})
