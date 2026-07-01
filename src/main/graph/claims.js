// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Small, pure helpers used by the graph builder to link footnotes to internal
// cross-reference targets and to register sources. No IO, no ids.js dependency —
// build.js owns id assignment; these functions only return plain data.

const SECTION_RE = /§\s*([IVXLCivxlc0-9]+(?:\.[A-Za-z0-9]+)*)|\bsection\s+([IVXLCivxlc0-9]+(?:\.[A-Za-z0-9]+)*)/i
const NOTE_RE = /\b(?:supra|infra)\s+note\s+(\d+)/i

/**
 * Extract a human-readable internal-reference label from a cross-reference
 * footnote's raw text, e.g. "See infra Section III.B." -> "Section III.B".
 * Falls back to a "supra/infra note N" style short-form, else null.
 * @param {string} rawText
 * @returns {string|null}
 */
export function parseCrossRefLabel(rawText) {
  const text = String(rawText ?? '')
  const sectionMatch = text.match(SECTION_RE)
  if (sectionMatch) {
    const label = sectionMatch[1] || sectionMatch[2]
    return `Section ${label}`
  }
  const noteMatch = text.match(NOTE_RE)
  if (noteMatch) {
    return `Note ${noteMatch[1]}`
  }
  return null
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'see', 'note', 'supra', 'infra', 'no', 'v', 'id', 'et', 'al'
])

/** Lowercase, NFKC-normalize, split on letter/digit boundaries and punctuation. */
function tokenize(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok && !STOPWORDS.has(tok))
}

/**
 * Best-matching SourceRaw for a footnote, by token overlap between the footnote's
 * rawText and each candidate source's key+title. Pure + deterministic: ties break
 * on register order (first wins).
 * @param {{rawText?: string}} footnote
 * @param {Array<{key:string,title?:string}>} registerSources
 * @returns {object|null}
 */
export function matchSourceForFootnote(footnote, registerSources) {
  if (!Array.isArray(registerSources) || registerSources.length === 0) return null
  const rawTokens = new Set(tokenize(footnote?.rawText))
  if (rawTokens.size === 0) return null

  let best = null
  let bestScore = 0
  for (const source of registerSources) {
    const candidateTokens = new Set([...tokenize(source?.key), ...tokenize(source?.title)])
    if (candidateTokens.size === 0) continue
    let overlap = 0
    for (const tok of candidateTokens) {
      if (rawTokens.has(tok)) overlap++
    }
    if (overlap === 0) continue
    const score = overlap / candidateTokens.size
    if (score > bestScore) {
      bestScore = score
      best = source
    }
  }
  return bestScore >= 0.3 ? best : null
}
