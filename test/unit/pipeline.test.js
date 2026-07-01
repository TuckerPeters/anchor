// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// End-to-end deterministic pipeline: generate a real DOCX + PDF, run extract -> build ->
// anchor -> persist, and prove the graph is built, anchored, and valid — the whole path.
import { it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDocument, updateDocument } from '../../src/main/store/documents.js'
import { uploadsDir, graphFile } from '../../src/main/store/paths.js'
import { runPipeline } from '../../src/main/jobs/pipeline.js'
import { validateGraph } from '../../src/main/graph/schema.js'
import { buildMinimalPdf } from '../fixtures/makePdf.js'
import { buildDocxFixture, wrapDocumentXml, wrapFootnotesXml } from '../fixtures/makeDocx.js'

let root, id
const CLAIM = 'The sky is distinctly blue in summer'

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'anchor-pipe-'))
  id = createDocument(root, { title: 'Pipe Test', now: '2026-06-30T00:00:00Z' }).id

  const body =
    `<w:p w14:paraId="AAAA1111"><w:r><w:t xml:space="preserve">${CLAIM}</w:t></w:r>` +
    `<w:r><w:footnoteReference w:id="2"/></w:r></w:p>`
  const footnotes = wrapFootnotesXml(
    `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
    `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
    `<w:footnote w:id="2"><w:p><w:r><w:t>Smith, Weather Patterns 12 (2020).</w:t></w:r></w:p></w:footnote>`
  )
  const docx = buildDocxFixture({ documentXml: wrapDocumentXml(body), footnotesXml: footnotes })
  const pdf = buildMinimalPdf([{ width: 320, height: 200, items: [{ text: CLAIM, x: 30, y: 150, size: 12 }] }])

  mkdirSync(uploadsDir(root, id), { recursive: true })
  writeFileSync(join(uploadsDir(root, id), 'report.docx'), docx)
  writeFileSync(join(uploadsDir(root, id), 'report.pdf'), pdf)
  updateDocument(root, id, { inputs: { docx: 'report.docx', pdf: 'report.pdf', register: null } })
})

it('runs the full deterministic pipeline into a valid, anchored graph', async () => {
  const events = []
  await runPipeline(root, id, { useAI: false }, (e) => events.push(e))

  expect(existsSync(graphFile(root, id))).toBe(true)
  const graph = JSON.parse(readFileSync(graphFile(root, id), 'utf8'))

  expect(validateGraph(graph).valid).toBe(true)
  expect(graph.stats.footnotes).toBe(1)
  expect(graph.stats.claims).toBeGreaterThanOrEqual(1)
  expect(graph.nodes.footnotes[0].number).toBe(1)
  expect(graph.nodes.footnotes[0].class).toBe('paper')

  const claim = graph.nodes.claims[0]
  expect(claim.pageId).toBe('p1')
  expect(claim.anchor.state).toBe('located')
  expect(claim.anchor.bbox).toBeTruthy()
  for (const k of ['x', 'y', 'w', 'h']) expect(claim.anchor.bbox[k]).toBeGreaterThanOrEqual(0)

  // every edge endpoint resolves to a real node id
  const ids = new Set([
    ...graph.nodes.pages, ...graph.nodes.claims, ...graph.nodes.footnotes,
    ...graph.nodes.sources, ...graph.nodes.targets
  ].map((n) => n.id))
  for (const e of graph.edges) { expect(ids.has(e.from)).toBe(true); expect(ids.has(e.to)).toBe(true) }
  expect(graph.edges.some((e) => e.type === 'page-claim')).toBe(true)
})

it('leaves the AI overlay empty on the deterministic path', async () => {
  await runPipeline(root, id, { useAI: false }, () => {})
  const graph = JSON.parse(readFileSync(graphFile(root, id), 'utf8'))
  expect(graph.nodes.footnotes[0].ai).toBeNull()
})
