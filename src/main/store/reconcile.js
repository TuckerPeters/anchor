// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.

function allNodeIds(graph) {
  const n = graph.nodes || {}
  return [
    ...(n.pages || []),
    ...(n.claims || []),
    ...(n.footnotes || []),
    ...(n.sources || []),
    ...(n.targets || [])
  ].map((x) => x.id)
}

/**
 * Keep review statuses whose node id still exists in the (possibly rebuilt) graph.
 * Vanished ids are moved to `orphans` (never deleted) and surfaced to the user.
 * @param {import('../../../shared/types.js').WorkState} ws
 * @param {import('../../../shared/types.js').Graph} graph
 * @returns {{workState: import('../../../shared/types.js').WorkState, orphanCount:number}}
 */
export function reconcileWorkState(ws, graph) {
  const ids = new Set(allNodeIds(graph))
  const nodes = {}
  const orphans = [...(ws.orphans || [])]
  let orphanCount = 0
  for (const [k, v] of Object.entries(ws.nodes || {})) {
    if (ids.has(k)) {
      nodes[k] = v
    } else {
      orphans.push({ nodeId: k, prev: v, reason: 'removed-on-rebuild' })
      orphanCount++
    }
  }
  return {
    workState: { ...ws, graphVersion: graph.graphVersion, nodes, orphans },
    orphanCount
  }
}
