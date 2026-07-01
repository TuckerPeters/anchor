// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { workStateFile } from './paths.js'

/** @returns {import('../../../shared/types.js').WorkState} */
export function emptyWorkState(id, now = new Date().toISOString()) {
  return { documentId: id, graphVersion: 0, updatedAt: now, nodes: {}, orphans: [] }
}

export function loadWorkState(root, id) {
  const f = workStateFile(root, id)
  if (!existsSync(f)) return emptyWorkState(id)
  const ws = JSON.parse(readFileSync(f, 'utf8'))
  if (!ws.orphans) ws.orphans = []
  if (!ws.nodes) ws.nodes = {}
  return ws
}

export function saveWorkState(root, id, ws) {
  const f = workStateFile(root, id)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(ws, null, 2))
  return { ok: true }
}

/** Newer = higher seq, then later updatedAt. */
function isNewer(a, b) {
  const as = a.seq ?? 0
  const bs = b.seq ?? 0
  if (as !== bs) return as > bs
  return (a.updatedAt || '') >= (b.updatedAt || '')
}

/**
 * Merge disk + incoming node-by-node, keeping the newer per node.
 * @param {import('../../../shared/types.js').WorkState} disk
 * @param {import('../../../shared/types.js').WorkState} incoming
 */
export function mergeWorkState(disk, incoming) {
  const nodes = { ...(disk.nodes || {}) }
  for (const [k, v] of Object.entries(incoming.nodes || {})) {
    const cur = nodes[k]
    if (!cur || isNewer(v, cur)) nodes[k] = v
  }
  return {
    ...disk,
    ...incoming,
    nodes,
    orphans: incoming.orphans ?? disk.orphans ?? []
  }
}
