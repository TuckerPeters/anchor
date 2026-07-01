// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Claim -> page anchoring (Phase 2b, the #1 accuracy risk). See build.js for the full
// buildGraph <-> anchorClaims <-> addPageEdges ordering contract; in short, this module
// consumes a graph already produced by buildGraph (claims with pageId:null) plus the raw
// PDF pages (with pdf.js item positions), and mutates each claim's pageId + anchor in
// place, returning the same graph.

import DiffMatchPatch from 'diff-match-patch'

const SOFT_HYPHEN_RE = /\u00ad/g
const HYPHEN_NEWLINE_RE = /-\n/g
const WHITESPACE_RE = /\s+/g

const LOCATED_THRESHOLD = 0.85
const APPROXIMATE_THRESHOLD = 0.4
const EXACT_SCORE = 1.0
const FUZZY_SCORE = 0.6

const DMP_PATTERN_MAX = 24 // stays comfortably under diff-match-patch's Match_MaxBits (32)
const BBOX_PREFIX_MAX = 40

function clamp01(v) {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/**
 * Normalize text for cross-source (DOCX claim vs PDF page) comparison: Unicode NFKC,
 * lowercase, strip soft hyphens, de-hyphenate line-end breaks, collapse whitespace.
 * @param {string} s
 */
export function normalizeText(s) {
  let t = String(s ?? '').normalize('NFKC').toLowerCase()
  t = t.replace(SOFT_HYPHEN_RE, '')
  t = t.replace(HYPHEN_NEWLINE_RE, '')
  t = t.replace(WHITESPACE_RE, ' ')
  return t.trim()
}

/**
 * Convert a pdf.js item/page box (points, origin bottom-left, y-up) into a normalized
 * 0-1 TOP-LEFT box (display space). This is the single place the y-axis flip happens —
 * the #1 source of upside-down highlight bugs, so it is a small, pure, directly-tested
 * function rather than inlined math.
 * @param {{x:number,y:number,w:number,h:number}} box
 * @param {number} pageW
 * @param {number} pageH
 */
export function pdfBoxToNormTopLeft(box, pageW, pageH) {
  if (!pageW || !pageH) return { x: 0, y: 0, w: 0, h: 0 }
  const nx = clamp01(box.x / pageW)
  const ny = clamp01(1 - (box.y + box.h) / pageH)
  const nw = clamp01(box.w / pageW)
  const nh = clamp01(box.h / pageH)
  return { x: nx, y: ny, w: Math.min(nw, 1 - nx), h: Math.min(nh, 1 - ny) }
}

function unionNormBoxes(items, pageW, pageH) {
  if (!items || items.length === 0) return null
  let box = null
  for (const it of items) {
    const nb = pdfBoxToNormTopLeft({ x: it.x, y: it.y, w: it.w, h: it.h }, pageW, pageH)
    if (!box) {
      box = { ...nb }
    } else {
      const x0 = Math.min(box.x, nb.x)
      const y0 = Math.min(box.y, nb.y)
      const x1 = Math.max(box.x + box.w, nb.x + nb.w)
      const y1 = Math.max(box.y + box.h, nb.y + nb.h)
      box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }
  }
  return box
}

/** Build one normalized string spanning every page, plus each page's [start,end) range. */
function buildGlobalIndex(rawPages, pageIdByNumber) {
  const parts = []
  const ranges = []
  let cursor = 0
  for (let i = 0; i < rawPages.length; i++) {
    const rawPage = rawPages[i]
    if (i > 0) {
      parts.push(' ')
      cursor += 1
    }
    const norm = normalizeText(rawPage.text)
    const start = cursor
    parts.push(norm)
    cursor += norm.length
    ranges.push({
      rawPage,
      pageId: pageIdByNumber.get(rawPage.number) ?? null,
      start,
      end: cursor
    })
  }
  return { globalText: parts.join(''), ranges }
}

/**
 * Exact indexOf first; fall back to a diff-match-patch fuzzy search over the whole
 * document (Match_Distance raised to the document length so the fuzzy search isn't
 * penalized for being "far" from an unknown expected location).
 */
function locateOffset(needle, globalText, dmp) {
  if (!needle) return { offset: -1, score: 0 }
  const exact = globalText.indexOf(needle)
  if (exact !== -1) return { offset: exact, score: EXACT_SCORE }

  const pattern = needle.slice(0, Math.min(DMP_PATTERN_MAX, needle.length))
  if (!pattern) return { offset: -1, score: 0 }
  dmp.Match_Distance = Math.max(1000, globalText.length)
  dmp.Match_Threshold = 0.5
  const loc = dmp.match_main(globalText, pattern, 0)
  if (loc === -1) return { offset: -1, score: 0 }
  return { offset: loc, score: FUZZY_SCORE }
}

function findRangeForOffset(offset, ranges) {
  for (const r of ranges) {
    if (offset >= r.start && offset < r.end) return r
  }
  if (ranges.length === 0) return null
  let best = ranges[0]
  let bestDist = Infinity
  for (const r of ranges) {
    const dist = Math.min(Math.abs(offset - r.start), Math.abs(offset - r.end))
    if (dist < bestDist) {
      bestDist = dist
      best = r
    }
  }
  return best
}

/** Locate the run of pdf.js items on one page whose concatenated text contains needlePrefix. */
function locateItemsOnPage(rawPage, needlePrefix, dmp) {
  const items = Array.isArray(rawPage?.items) ? rawPage.items : []
  if (items.length === 0) return []
  const spans = []
  let cursor = 0
  const parts = []
  for (const item of items) {
    const norm = normalizeText(item.str)
    if (!norm) continue
    if (cursor > 0) {
      parts.push(' ')
      cursor += 1
    }
    const start = cursor
    parts.push(norm)
    cursor += norm.length
    spans.push({ item, start, end: cursor })
  }
  const pageText = parts.join('')
  const prefix = needlePrefix.slice(0, Math.min(BBOX_PREFIX_MAX, needlePrefix.length))
  if (!prefix) return []

  let matchStart = pageText.indexOf(prefix)
  let matchLen = prefix.length
  if (matchStart === -1) {
    const pattern = prefix.slice(0, Math.min(DMP_PATTERN_MAX, prefix.length))
    if (!pattern) return []
    dmp.Match_Distance = Math.max(1000, pageText.length)
    dmp.Match_Threshold = 0.5
    matchStart = dmp.match_main(pageText, pattern, 0)
    matchLen = pattern.length
  }
  if (matchStart === -1) return []
  const matchEnd = matchStart + matchLen
  return spans.filter((s) => s.end > matchStart && s.start < matchEnd).map((s) => s.item)
}

/**
 * @param {import('../../../shared/types.js').Graph} graph
 * @param {Array} pages  raw PageData[] (with pdf.js item positions), i.e. pdf.pages
 * @returns {import('../../../shared/types.js').Graph}
 */
export function anchorClaims(graph, pages) {
  const rawPages = Array.isArray(pages) ? pages : []
  const pageIdByNumber = new Map(graph.nodes.pages.map((p) => [p.number, p.id]))
  const { globalText, ranges } = buildGlobalIndex(rawPages, pageIdByNumber)
  const dmp = new DiffMatchPatch()

  for (const claim of graph.nodes.claims) {
    const needle = normalizeText(claim.text)
    if (!needle) {
      claim.pageId = null
      claim.anchor = { state: 'none', score: 0 }
      continue
    }

    const { offset, score } = locateOffset(needle, globalText, dmp)
    if (offset === -1) {
      claim.pageId = null
      claim.anchor = { state: 'none', score: 0 }
      continue
    }

    const range = findRangeForOffset(offset, ranges)
    if (!range || !range.pageId) {
      claim.pageId = null
      claim.anchor = { state: 'none', score: 0 }
      continue
    }

    const state = score >= LOCATED_THRESHOLD ? 'located' : score >= APPROXIMATE_THRESHOLD ? 'approximate' : 'none'
    claim.pageId = range.pageId
    const anchor = { state, score }

    if (state !== 'none') {
      const items = locateItemsOnPage(range.rawPage, needle, dmp)
      let bbox = unionNormBoxes(items, range.rawPage.width, range.rawPage.height)
      if (!bbox) {
        const span = Math.max(1, range.end - range.start)
        const fraction = clamp01((offset - range.start) / span)
        const y = Math.min(fraction, 0.95)
        bbox = { x: 0.1, y, w: 0.8, h: 0.05 }
      }
      anchor.bbox = {
        x: clamp01(bbox.x),
        y: clamp01(bbox.y),
        w: clamp01(Math.min(bbox.w, 1 - clamp01(bbox.x))),
        h: clamp01(Math.min(bbox.h, 1 - clamp01(bbox.y)))
      }
    }

    claim.anchor = anchor
  }

  return graph
}
