// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Content-derived, stable node ids. Stability across re-analysis is the whole point:
// if ids shift on rebuild, human review state reattaches to the wrong nodes.

/** @param {string} s */
export function slug(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'x'
}

export const pageId = (n) => `p${n}`
export const footnoteId = (displayNumber) => `f${displayNumber}`
export const sourceId = (key) => `s-${slug(key)}`
export const claimId = (paraId) => `c-${slug(paraId)}`
export const targetId = (label) => `t-${slug(label)}`

/**
 * Deterministically resolve id collisions in document order.
 * @param {string} id @param {Set<string>} used
 */
export function dedupeId(id, used) {
  if (!used.has(id)) { used.add(id); return id }
  let n = 2
  while (used.has(`${id}-${n}`)) n++
  const out = `${id}-${n}`
  used.add(out)
  return out
}
