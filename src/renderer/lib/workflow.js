// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// The review model: status metadata, coverage math, and queue derivation shared by the
// Documents cards and the Review workspace.

export const STATUS_ORDER = ['todo', 'in-progress', 'done', 'blocked']

export const STATUS_META = {
  'todo': { label: 'To do', color: 'todo', icon: 'circle' },
  'in-progress': { label: 'In progress', color: 'progress', icon: 'half' },
  'done': { label: 'Done', color: 'done', icon: 'check' },
  'blocked': { label: 'Blocked', color: 'blocked', icon: 'x' }
}

export const SUBSTEP_META = {
  'source-found': 'Source found',
  'support-verified': 'Support verified',
  'draft-written': 'Draft written'
}
export const SUBSTEPS = ['source-found', 'support-verified', 'draft-written']

/** Nodes that appear in the review queue and count toward coverage. */
export function reviewableIds(graph) {
  if (!graph) return []
  return [
    ...graph.nodes.footnotes.map((f) => f.id),
    ...graph.nodes.sources.map((s) => s.id)
  ]
}

export function statusOf(ws, id) {
  return ws?.nodes?.[id]?.status || 'todo'
}

export function coverage(graph, ws) {
  const ids = reviewableIds(graph)
  const total = ids.length
  let done = 0, blocked = 0, inProgress = 0, todo = 0
  for (const id of ids) {
    const s = statusOf(ws, id)
    if (s === 'done') done++
    else if (s === 'blocked') blocked++
    else if (s === 'in-progress') inProgress++
    else todo++
  }
  return { total, done, blocked, inProgress, todo, pct: total ? Math.round((done / total) * 100) : 0 }
}

// Queue grouping — plain-English "kinds" of uncertainty a reviewer resolves.
export const QUEUE_KINDS = [
  { key: 'missing-source', label: 'Missing source', hint: 'The footnote does not point to an identifiable source yet.' },
  { key: 'needs-pincite', label: 'Needs a pincite', hint: 'A page, section, or docket number still has to be pinned down.' },
  { key: 'cross-reference', label: 'Unconfirmed cross-reference', hint: 'An internal "see supra/infra" target has not been confirmed.' },
  { key: 'reused-source', label: 'Reused source', hint: 'One source supports several claims — resolving it clears them all.' },
  { key: 'support', label: 'Support to verify', hint: 'A source is identified but its support for the claim is unverified.' }
]

function footnoteKind(fn, source) {
  if (fn.role === 'cross-reference' || fn.class === 'cross-reference') return 'cross-reference'
  if (fn.class === 'missing' || !source) return 'missing-source'
  if (source && source.class === 'missing') return 'missing-source'
  if (source && (source.footnoteIds?.length || 0) > 1) return 'reused-source'
  if (fn.class === 'case' || /page|pincite|docket|version|commit|hash|edition/i.test(fn.citationNeed || '')) return 'needs-pincite'
  return 'support'
}

/**
 * Build the review queue: one item per footnote (the atomic unit a reviewer works),
 * tagged by kind and carrying its claim/source/target context and current status.
 */
export function buildQueue(graph, ws) {
  if (!graph) return []
  const sById = Object.fromEntries(graph.nodes.sources.map((s) => [s.id, s]))
  const cById = Object.fromEntries(graph.nodes.claims.map((c) => [c.id, c]))
  const tById = Object.fromEntries(graph.nodes.targets.map((t) => [t.id, t]))
  return graph.nodes.footnotes.map((fn) => {
    const source = fn.sourceIds.map((id) => sById[id]).find(Boolean) || null
    const claims = fn.claimIds.map((id) => cById[id]).filter(Boolean)
    const targets = fn.candidateTargetIds.map((id) => tById[id]).filter(Boolean)
    const kind = footnoteKind(fn, source)
    // The node a reviewer acts on: the source when there is one, else the footnote itself.
    const nodeId = source ? source.id : fn.id
    return {
      id: fn.id,
      nodeId,
      kind,
      footnote: fn,
      source,
      claims,
      targets,
      status: statusOf(ws, nodeId),
      substep: ws?.nodes?.[nodeId]?.substep || null
    }
  })
}
