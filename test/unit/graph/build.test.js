// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe } from 'vitest'
import { buildGraph, addPageEdges } from '../../../src/main/graph/build.js'
import { anchorClaims } from '../../../src/main/graph/anchor.js'
import { validateGraph } from '../../../src/main/graph/schema.js'

function fixture() {
  const pdf = {
    pages: [
      {
        number: 1, width: 600, height: 800, items: [],
        text: 'Fast charging reduces battery life significantly over many cycles. Standardized testing protocols are required before certification.'
      },
      {
        number: 2, width: 600, height: 800, items: [],
        text: 'See infra Section III.B for the methodology details. Additional test data remains on file internally.'
      }
    ],
    textLayer: true
  }
  const docx = {
    footnotes: [
      { wid: 'fn1', number: 1, rawText: 'NREL, Battery Degradation Study (2021).', role: 'support' },
      { wid: 'fn2', number: 2, rawText: 'UL 9540A Test Method Documentation (3rd ed.).', role: 'support' },
      { wid: 'fn3', number: 3, rawText: 'See infra Section III.B.', role: 'cross-reference' },
      { wid: 'fn4', number: 4, rawText: 'Internal test data, on file.', role: 'note' }
    ],
    paragraphs: [
      { paraId: 'w1', index: 0, text: 'Fast charging reduces battery life significantly over many cycles.', footnoteRefs: [1] },
      { paraId: 'w2', index: 1, text: 'Standardized testing protocols are required before certification.', footnoteRefs: [2] },
      { paraId: 'w3', index: 2, text: 'This paragraph has no footnote and should not become a claim.', footnoteRefs: [] },
      { paraId: 'w4', index: 3, text: 'See infra Section III.B for the methodology details.', footnoteRefs: [3] },
      { paraId: 'w5', index: 4, text: 'Additional test data remains on file internally.', footnoteRefs: [4] }
    ],
    warnings: []
  }
  const register = {
    sources: [
      { key: 'NREL2021', class: 'paper', title: 'NREL Battery Degradation Study', url: ['https://nrel.gov'], localCandidate: '', auditNote: '', citationNeed: '' }
    ]
  }
  return { pdf, docx, register }
}

describe('buildGraph', () => {
  it('produces the expected node/edge counts and links from a synthetic fixture', () => {
    const { pdf, docx, register } = fixture()
    const graph = buildGraph({ pdf, docx, register, documentId: 'doc1', graphVersion: 1, now: '2026-06-30T00:00:00Z' })

    expect(graph.stats).toEqual({ pages: 2, claims: 4, footnotes: 4, sources: 3, targets: 1, edges: 11 })
    expect(graph.documentId).toBe('doc1')
    expect(graph.generatedAt).toBe('2026-06-30T00:00:00Z')

    // paragraph w3 has no footnoteRefs -> not a claim
    expect(graph.nodes.claims.map((c) => c.paraId)).toEqual(['w1', 'w2', 'w4', 'w5'])

    // register source matched by token overlap
    const claimW1 = graph.nodes.claims.find((c) => c.paraId === 'w1')
    expect(claimW1.sourceIds).toEqual(['s-nrel2021'])
    const nrelSource = graph.nodes.sources.find((s) => s.id === 's-nrel2021')
    expect(nrelSource.footnoteIds).toEqual(['f1'])
    expect(nrelSource.claimIds).toEqual(['c-w1'])

    // unmatched, non-missing, non-cross-reference footnote derives its own source
    const claimW2 = graph.nodes.claims.find((c) => c.paraId === 'w2')
    expect(claimW2.sourceIds).toHaveLength(1)
    const derivedSource = graph.nodes.sources.find((s) => s.id === claimW2.sourceIds[0])
    expect(derivedSource.class).toBe('docs')

    // cross-reference footnote creates a target and NO source
    const claimW4 = graph.nodes.claims.find((c) => c.paraId === 'w4')
    expect(claimW4.sourceIds).toEqual([])
    const footnote3 = graph.nodes.footnotes.find((f) => f.number === 3)
    expect(footnote3.class).toBe('cross-reference')
    expect(footnote3.sourceIds).toEqual([])
    expect(footnote3.candidateTargetIds).toEqual(['t-section-iii-b'])
    expect(graph.nodes.targets).toEqual([{ id: 't-section-iii-b', label: 'Section III.B', note: '', footnoteIds: ['f3'] }])

    // missing-class footnote gets an attached missing source
    const claimW5 = graph.nodes.claims.find((c) => c.paraId === 'w5')
    expect(claimW5.sourceIds).toEqual(['s-missing-4'])
    const missingSource = graph.nodes.sources.find((s) => s.id === 's-missing-4')
    expect(missingSource.class).toBe('missing')

    // no page-claim edges yet — buildGraph defers those to addPageEdges (see ordering contract)
    expect(graph.edges.some((e) => e.type === 'page-claim')).toBe(false)
    expect(graph.nodes.claims.every((c) => c.pageId === null)).toBe(true)
    expect(graph.nodes.claims.every((c) => c.anchor.state === 'none' && c.anchor.score === 0)).toBe(true)

    // ai overlays are untouched by the deterministic builder
    expect(graph.generator.ai).toBeNull()
    expect(graph.nodes.footnotes.every((f) => f.ai === null)).toBe(true)
    expect(graph.nodes.sources.every((s) => s.ai === null)).toBe(true)
  })

  it('every edge endpoint resolves to a real node id', () => {
    const { pdf, docx, register } = fixture()
    const graph = buildGraph({ pdf, docx, register })
    const allIds = new Set([
      ...graph.nodes.pages.map((n) => n.id),
      ...graph.nodes.claims.map((n) => n.id),
      ...graph.nodes.footnotes.map((n) => n.id),
      ...graph.nodes.sources.map((n) => n.id),
      ...graph.nodes.targets.map((n) => n.id)
    ])
    expect(graph.edges.length).toBeGreaterThan(0)
    for (const edge of graph.edges) {
      expect(allIds.has(edge.from)).toBe(true)
      expect(allIds.has(edge.to)).toBe(true)
    }
  })

  it('produces stable ids across two runs with the same input', () => {
    const { pdf, docx, register } = fixture()
    const g1 = buildGraph({ pdf, docx, register, documentId: 'doc1', now: '2026-06-30T00:00:00Z' })
    const g2 = buildGraph({ pdf, docx, register, documentId: 'doc1', now: '2026-06-30T00:00:00Z' })
    expect(g2).toEqual(g1)
  })

  it('validates against the graph schema', () => {
    const { pdf, docx, register } = fixture()
    const graph = buildGraph({ pdf, docx, register })
    const result = validateGraph(graph)
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('resolves sourceId collisions deterministically via dedupeId', () => {
    const pdf = { pages: [{ number: 1, width: 600, height: 800, items: [], text: '' }] }
    const docx = { footnotes: [], paragraphs: [] }
    const register = {
      sources: [
        { key: 'NREL_2021', class: 'paper', title: 'First' },
        { key: 'NREL 2021', class: 'paper', title: 'Second' }
      ]
    }
    const graph = buildGraph({ pdf, docx, register })
    expect(graph.nodes.sources.map((s) => s.id)).toEqual(['s-nrel-2021', 's-nrel-2021-2'])
  })

  it('full pipeline: buildGraph -> anchorClaims -> addPageEdges produces page-claim edges + valid graph', () => {
    const { pdf, docx, register } = fixture()
    const graph = buildGraph({ pdf, docx, register, documentId: 'doc1', now: '2026-06-30T00:00:00Z' })
    const preAnchorEdgeCount = graph.edges.length

    anchorClaims(graph, pdf.pages)
    expect(graph.nodes.claims.every((c) => c.pageId !== null)).toBe(true)

    addPageEdges(graph)
    const pageClaimEdges = graph.edges.filter((e) => e.type === 'page-claim')
    expect(pageClaimEdges).toHaveLength(graph.nodes.claims.length)
    expect(graph.edges.length).toBe(preAnchorEdgeCount + graph.nodes.claims.length)
    expect(graph.stats.edges).toBe(graph.edges.length)

    // idempotent: calling addPageEdges again does not duplicate page-claim edges
    addPageEdges(graph)
    expect(graph.edges.filter((e) => e.type === 'page-claim')).toHaveLength(graph.nodes.claims.length)

    expect(validateGraph(graph).valid).toBe(true)
  })
})
