// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDocument } from '../../../src/main/store/documents.js'
import { emptyWorkState, loadWorkState, saveWorkState, mergeWorkState } from '../../../src/main/store/workState.js'

let root, id
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anchor-'))
  id = createDocument(root, { title: 'X', now: '2026-06-30T00:00:00Z' }).id
})

it('empty work-state has the new shape', () => {
  const ws = emptyWorkState('x', '2026-06-30T00:00:00Z')
  expect(ws).toMatchObject({ documentId: 'x', graphVersion: 0, nodes: {}, orphans: [] })
})

it('round-trips work-state to disk', () => {
  const ws = {
    documentId: id, graphVersion: 1, updatedAt: '2026-06-30T00:00:00Z', orphans: [],
    nodes: { f3: { status: 'in-progress', substep: 'source-found', note: 'ok', resolution: '', updatedAt: '2026-06-30T00:00:00Z', seq: 1 } }
  }
  saveWorkState(root, id, ws)
  expect(loadWorkState(root, id).nodes.f3.status).toBe('in-progress')
})

it('merge prefers higher seq, then newer updatedAt', () => {
  const disk = { nodes: { f3: { status: 'todo', seq: 1, updatedAt: '2026-06-30T00:00:00Z' } } }
  const inc = { nodes: { f3: { status: 'done', seq: 2, updatedAt: '2026-06-30T00:00:00Z' }, f6: { status: 'blocked', seq: 1, updatedAt: '2026-06-30T01:00:00Z' } } }
  const merged = mergeWorkState(disk, inc)
  expect(merged.nodes.f3.status).toBe('done')
  expect(merged.nodes.f6.status).toBe('blocked')
})

it('does not regress a node to an older seq', () => {
  const disk = { nodes: { f3: { status: 'done', seq: 5, updatedAt: '2026-06-30T05:00:00Z' } } }
  const inc = { nodes: { f3: { status: 'todo', seq: 2, updatedAt: '2026-06-30T02:00:00Z' } } }
  expect(mergeWorkState(disk, inc).nodes.f3.status).toBe('done')
})
