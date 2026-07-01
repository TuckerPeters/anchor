// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Deterministic graph builder (Phase 3). No AI, no network — every `ai` overlay field
// on the produced nodes is `null`.
//
// ORDERING CONTRACT (buildGraph <-> anchorClaims <-> addPageEdges):
//   1. buildGraph({ pdf, docx, register })  builds every node (pages, claims, footnotes,
//      sources, targets) and every edge type EXCEPT 'page-claim' — claims start with
//      pageId:null and anchor:{state:'none',score:0}. This keeps buildGraph a pure,
//      self-contained function of the extractor output (testable without pdf.js item
//      positions or diff-match-patch).
//   2. The caller then runs `anchorClaims(graph, pdf.pages)` (graph/anchor.js), which
//      mutates each claim's `pageId` + `anchor` in place using the PDF text layer.
//   3. The caller finally runs `addPageEdges(graph)` to add the now-resolvable
//      'page-claim' edges and recompute `stats.edges`. addPageEdges is idempotent: it
//      strips any 'page-claim' edges already present before re-adding, so re-running the
//      anchor -> addPageEdges pair after a re-anchor never duplicates edges.
//   A full pipeline therefore reads:
//     const graph = buildGraph({ pdf, docx, register, documentId, now })
//     anchorClaims(graph, pdf.pages)
//     addPageEdges(graph)

import { slug, pageId, footnoteId, sourceId, claimId, targetId, dedupeId } from './ids.js'
import { classifyFootnote } from './classify.js'
import { parseCrossRefLabel, matchSourceForFootnote } from './claims.js'

const GENERATOR_VERSION = 'anchor-deterministic-graph@1'

/** @param {Array} edges */
function nextEdgeIdFactory(edges) {
  let max = 0
  for (const e of edges) {
    const m = /^e(\d+)$/.exec(e?.id || '')
    if (m) max = Math.max(max, Number(m[1]))
  }
  let n = max
  return () => {
    n += 1
    return `e${n}`
  }
}

function firstWords(text, count) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).slice(0, count).join(' ')
}

/**
 * @param {{pdf:{pages:Array}, docx:{footnotes:Array, paragraphs:Array, warnings?:string[]},
 *           register:{sources:Array}, documentId?:string, graphVersion?:number, now?:string}} args
 * @returns {import('../../../shared/types.js').Graph}
 */
export function buildGraph({ pdf, docx, register, documentId = 'doc', graphVersion = 1, now = '1970-01-01T00:00:00Z' }) {
  const usedIds = new Set()
  const rawPages = Array.isArray(pdf?.pages) ? pdf.pages : []
  const rawFootnotes = Array.isArray(docx?.footnotes) ? docx.footnotes : []
  const rawParagraphs = Array.isArray(docx?.paragraphs) ? docx.paragraphs : []
  const registerSources = Array.isArray(register?.sources) ? register.sources : []

  // ---- pages ----
  const pages = rawPages.map((p) => ({
    id: dedupeId(pageId(p.number), usedIds),
    number: p.number,
    width: p.width,
    height: p.height,
    text: p.text ?? ''
  }))

  // ---- footnotes (classify + role passthrough) ----
  const footnotes = []
  const footnoteNodeByNumber = new Map()
  for (const fn of rawFootnotes) {
    const { class: cls, citationNeed } = classifyFootnote(fn.rawText)
    const node = {
      id: dedupeId(footnoteId(fn.number), usedIds),
      number: fn.number,
      role: fn.role,
      rawText: fn.rawText ?? '',
      sourceIds: [],
      candidateTargetIds: [],
      claimIds: [],
      class: cls,
      citationNeed,
      ai: null
    }
    footnotes.push(node)
    footnoteNodeByNumber.set(fn.number, node)
  }

  // ---- sources: start from the register, id = sourceId(key) ----
  const sources = []
  const sourceNodeByKey = new Map()
  for (const s of registerSources) {
    const node = {
      id: dedupeId(sourceId(s.key), usedIds),
      key: s.key,
      class: s.class,
      title: s.title ?? '',
      url: Array.isArray(s.url) ? s.url : [],
      localCandidate: s.localCandidate ?? '',
      auditNote: s.auditNote ?? '',
      citationNeed: s.citationNeed ?? '',
      claimIds: [],
      footnoteIds: [],
      ai: null
    }
    sources.push(node)
    sourceNodeByKey.set(s.key, node)
  }

  // Pass A — link every footnote to a source (matched register hit wins regardless of
  // class; otherwise fall back by class).
  for (const fn of rawFootnotes) {
    const fnNode = footnoteNodeByNumber.get(fn.number)
    const matched = matchSourceForFootnote(fn, registerSources)
    if (matched) {
      const sourceNode = sourceNodeByKey.get(matched.key)
      if (sourceNode) {
        if (!fnNode.sourceIds.includes(sourceNode.id)) fnNode.sourceIds.push(sourceNode.id)
        if (!sourceNode.footnoteIds.includes(fnNode.id)) sourceNode.footnoteIds.push(fnNode.id)
      }
      continue
    }
    if (fnNode.class === 'missing') {
      const key = `missing-${fn.number}`
      const node = {
        id: dedupeId(sourceId(key), usedIds),
        key,
        class: 'missing',
        title: (fn.rawText ?? '').slice(0, 80),
        url: [],
        localCandidate: '',
        auditNote: '',
        citationNeed: fnNode.citationNeed,
        claimIds: [],
        footnoteIds: [fnNode.id],
        ai: null
      }
      sources.push(node)
      fnNode.sourceIds.push(node.id)
      continue
    }
    if (fnNode.class === 'cross-reference') {
      // No source — this footnote points inside the document, handled by targets below.
      continue
    }
    // Derive a source from the footnote itself.
    const key = slug(firstWords(fn.rawText, 6))
    const node = {
      id: dedupeId(sourceId(key), usedIds),
      key,
      class: fnNode.class,
      title: (fn.rawText ?? '').slice(0, 80),
      url: [],
      localCandidate: '',
      auditNote: '',
      citationNeed: fnNode.citationNeed,
      claimIds: [],
      footnoteIds: [fnNode.id],
      ai: null
    }
    sources.push(node)
    fnNode.sourceIds.push(node.id)
  }

  // Pass B — targets: every cross-reference-classified footnote resolves to (or shares) a target.
  const targets = []
  const targetNodeByLabel = new Map()
  for (const fn of rawFootnotes) {
    const fnNode = footnoteNodeByNumber.get(fn.number)
    if (fnNode.class !== 'cross-reference') continue
    const label = parseCrossRefLabel(fn.rawText) || `Cross-reference ${fn.number}`
    let targetNode = targetNodeByLabel.get(label)
    if (!targetNode) {
      targetNode = { id: dedupeId(targetId(label), usedIds), label, note: '', footnoteIds: [] }
      targets.push(targetNode)
      targetNodeByLabel.set(label, targetNode)
    }
    if (!fnNode.candidateTargetIds.includes(targetNode.id)) fnNode.candidateTargetIds.push(targetNode.id)
    if (!targetNode.footnoteIds.includes(fnNode.id)) targetNode.footnoteIds.push(fnNode.id)
  }

  // ---- claims: paragraphs with at least one footnote reference ----
  const footnoteNodeById = new Map(footnotes.map((f) => [f.id, f]))
  const sourceNodeById = new Map(sources.map((s) => [s.id, s]))
  const claims = []
  for (const para of rawParagraphs) {
    const refs = Array.isArray(para.footnoteRefs) ? para.footnoteRefs : []
    if (refs.length === 0) continue
    const footnoteRefs = refs.map((n) => footnoteNodeByNumber.get(n)?.id).filter(Boolean)
    const claimNode = {
      id: dedupeId(claimId(para.paraId), usedIds),
      paraId: para.paraId,
      pageId: null,
      text: para.text ?? '',
      footnoteRefs,
      sourceIds: [],
      anchor: { state: 'none', score: 0 }
    }
    // sourceIds = union of this claim's footnotes' sourceIds (first-seen order)
    for (const fid of footnoteRefs) {
      const fnNode = footnoteNodeById.get(fid)
      if (!fnNode) continue
      if (!fnNode.claimIds.includes(claimNode.id)) fnNode.claimIds.push(claimNode.id)
      for (const sid of fnNode.sourceIds) {
        if (!claimNode.sourceIds.includes(sid)) claimNode.sourceIds.push(sid)
      }
    }
    for (const sid of claimNode.sourceIds) {
      const sourceNode = sourceNodeById.get(sid)
      if (sourceNode && !sourceNode.claimIds.includes(claimNode.id)) sourceNode.claimIds.push(claimNode.id)
    }
    claims.push(claimNode)
  }

  // ---- edges (page-claim deferred to addPageEdges, see ordering contract above) ----
  const edges = []
  const nextEdgeId = nextEdgeIdFactory(edges)
  for (const claim of claims) {
    for (const fid of claim.footnoteRefs) {
      edges.push({ id: nextEdgeId(), type: 'claim-footnote', from: claim.id, to: fid })
    }
    for (const sid of claim.sourceIds) {
      edges.push({ id: nextEdgeId(), type: 'claim-source', from: claim.id, to: sid })
    }
  }
  for (const fnNode of footnotes) {
    for (const sid of fnNode.sourceIds) {
      edges.push({ id: nextEdgeId(), type: 'footnote-source', from: fnNode.id, to: sid })
    }
    for (const tid of fnNode.candidateTargetIds) {
      edges.push({ id: nextEdgeId(), type: 'footnote-target', from: fnNode.id, to: tid })
    }
  }

  const stats = {
    pages: pages.length,
    claims: claims.length,
    footnotes: footnotes.length,
    sources: sources.length,
    targets: targets.length,
    edges: edges.length
  }

  return {
    documentId,
    generatedAt: now,
    graphVersion,
    generator: { version: GENERATOR_VERSION, ai: null },
    stats,
    inputs: {
      docx: null,
      pdf: null,
      register: null,
      textLayer: typeof pdf?.textLayer === 'boolean' ? pdf.textLayer : true,
      warnings: Array.isArray(docx?.warnings) ? docx.warnings : []
    },
    nodes: { pages, claims, footnotes, sources, targets },
    edges
  }
}

/**
 * Adds 'page-claim' edges for every claim that has a pageId (set by anchorClaims) and
 * recomputes stats.edges. Idempotent: strips any existing 'page-claim' edges first, so
 * calling it again after a re-anchor never duplicates edges. See the ordering contract
 * at the top of this file.
 * @param {import('../../../shared/types.js').Graph} graph
 */
export function addPageEdges(graph) {
  const base = graph.edges.filter((e) => e.type !== 'page-claim')
  const nextEdgeId = nextEdgeIdFactory(base)
  const pageEdges = []
  for (const claim of graph.nodes.claims) {
    if (claim.pageId) {
      pageEdges.push({ id: nextEdgeId(), type: 'page-claim', from: claim.pageId, to: claim.id })
    }
  }
  graph.edges = [...base, ...pageEdges]
  graph.stats.edges = graph.edges.length
  return graph
}
