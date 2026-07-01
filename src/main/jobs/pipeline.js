// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// The build pipeline. Deterministic path (always): extract -> buildGraph -> anchorClaims
// -> persist -> reconcile work-state. Enhance path (optional): AI passes writing ai.* overlays.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { uploadsDir, graphFile, docDir } from '../store/paths.js'
import { getDocument, updateDocument } from '../store/documents.js'
import { loadWorkState, saveWorkState } from '../store/workState.js'
import { reconcileWorkState } from '../store/reconcile.js'
import { extractPdf } from '../extract/pdf.js'
import { extractDocx } from '../extract/docx.js'
import { parseRegister } from '../extract/register.js'
import { buildGraph, addPageEdges } from '../graph/build.js'
import { anchorClaims } from '../graph/anchor.js'
import { detectAgents } from '../ai/detect.js'
import { invokeAgent } from '../ai/invoke.js'
import { enhanceGraph } from '../ai/passes.js'

function persistGraph(root, id, graph) {
  writeFileSync(graphFile(root, id), JSON.stringify(graph, null, 2))
}

export async function runPipeline(root, id, opts, emit) {
  const doc = getDocument(root, id)
  const up = uploadsDir(root, id)
  const path = (name) => (name ? join(up, name) : null)
  const pdfPath = path(doc.inputs.pdf)
  const docxPath = path(doc.inputs.docx)
  const regPath = path(doc.inputs.register)

  // ── Extract ────────────────────────────────────────────────────────────────
  emit({ progress: { phase: 'extract', pct: 12, message: 'Reading your documents…' } })
  const warnings = []
  let pdf = { pages: [], textLayer: true }
  if (pdfPath && existsSync(pdfPath)) pdf = await extractPdf(pdfPath)
  let docx = { footnotes: [], paragraphs: [], warnings: [] }
  if (docxPath && existsSync(docxPath)) { docx = await extractDocx(docxPath); warnings.push(...(docx.warnings || [])) }
  let register = { sources: [] }
  if (regPath && existsSync(regPath)) register = await parseRegister(regPath)
  const scanned = pdf.textLayer === false
  if (scanned) warnings.push('scanned-pdf')
  if (!(pdfPath && docxPath)) warnings.push('single-file')

  // ── Build + anchor ──────────────────────────────────────────────────────────
  emit({ progress: { phase: 'graph', pct: 45, message: 'Mapping citations to sources…' } })
  const graphVersion = (doc.graphVersion || 0) + 1
  let graph = buildGraph({ pdf, docx, register, documentId: id, graphVersion, now: new Date().toISOString() })

  emit({ progress: { phase: 'anchor', pct: 66, message: 'Locating each claim on its page…' } })
  graph = anchorClaims(graph, pdf.pages)
  addPageEdges(graph)
  graph.inputs = { docx: doc.inputs.docx, pdf: doc.inputs.pdf, register: doc.inputs.register, textLayer: !scanned, warnings }

  persistGraph(root, id, graph)
  updateDocument(root, id, {
    status: 'ready', graphVersion, stats: graph.stats,
    flags: { textLayer: !scanned, scanned, singleFile: !(pdfPath && docxPath) }
  })

  // Reconcile any existing review state against the freshly built graph.
  const { workState } = reconcileWorkState(loadWorkState(root, id), graph)
  saveWorkState(root, id, workState)

  if (scanned) emit({ progress: { phase: 'anchor', pct: 72, warning: 'This PDF looks scanned — citations may be incomplete.' } })

  // ── Optional AI enhancement (never blocks, never throws) ──────────────────────
  if (opts.useAI) {
    emit({ progress: { phase: 'enhance', pct: 78, message: 'AI is reviewing the footnotes…' } })
    try {
      let engine = opts.engine
      if (!engine) { const d = await detectAgents(); engine = d.claude?.signedIn ? 'claude' : d.codex?.signedIn ? 'codex' : null }
      if (engine) {
        const cpFile = join(docDir(root, id), 'jobs', 'checkpoint.json')
        const writeCheckpoint = (cp) => { try { mkdirSync(join(docDir(root, id), 'jobs'), { recursive: true }); writeFileSync(cpFile, JSON.stringify(cp)) } catch { /* ignore */ } }
        graph = await enhanceGraph(graph, {
          engine, invoke: invokeAgent, writeCheckpoint,
          onProgress: (pr) => emit({ progress: { phase: 'enhance', pct: 78 + Math.round((pr.pct || 0) * 0.2), message: pr.message || 'AI reviewing…' } })
        })
        graph.generator = { ...(graph.generator || {}), ai: { engine, model: engine } }
        persistGraph(root, id, graph)
        const cur = getDocument(root, id)
        updateDocument(root, id, { ai: { ...cur.ai, used: true, engine, lastUsedAt: new Date().toISOString() } })
      } else {
        emit({ progress: { phase: 'enhance', pct: 96, message: 'No AI connected — kept the standard review.' } })
      }
    } catch (e) {
      emit({ progress: { phase: 'enhance', pct: 96, message: 'AI step skipped: ' + String(e?.message || e) } })
    }
  }
}
