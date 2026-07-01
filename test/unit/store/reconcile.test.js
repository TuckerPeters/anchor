// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect } from 'vitest'
import { reconcileWorkState } from '../../../src/main/store/reconcile.js'

it('orphans statuses whose node id no longer exists, keeps survivors', () => {
  const ws = {
    documentId: 'x', graphVersion: 1, updatedAt: 't', orphans: [],
    nodes: { f3: { status: 'done', seq: 1 }, f9: { status: 'blocked', seq: 1 } }
  }
  const graph = {
    graphVersion: 2,
    nodes: { footnotes: [{ id: 'f3' }], sources: [], claims: [], pages: [], targets: [] }
  }
  const { workState, orphanCount } = reconcileWorkState(ws, graph)
  expect(workState.nodes.f3.status).toBe('done')
  expect(workState.nodes.f9).toBeUndefined()
  expect(orphanCount).toBe(1)
  expect(workState.orphans[0].nodeId).toBe('f9')
  expect(workState.graphVersion).toBe(2)
})

it('is a no-op when everything still matches', () => {
  const ws = { documentId: 'x', graphVersion: 2, updatedAt: 't', orphans: [], nodes: { p1: { status: 'todo', seq: 0 } } }
  const graph = { graphVersion: 2, nodes: { pages: [{ id: 'p1' }], claims: [], footnotes: [], sources: [], targets: [] } }
  const { orphanCount } = reconcileWorkState(ws, graph)
  expect(orphanCount).toBe(0)
})
