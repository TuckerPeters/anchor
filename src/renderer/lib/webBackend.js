// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Browser backend: implements the same window.anchor API surface as the desktop preload,
// but backed by IndexedDB and a client-side pipeline. Runs the full deterministic
// "Standard review" entirely in the browser — nothing is uploaded. (AI needs the desktop app.)
import { buildGraph, addPageEdges } from '../../main/graph/build.js'
import { anchorClaims } from '../../main/graph/anchor.js'
import { reconcileWorkState } from '../../main/store/reconcile.js'
import { parseDocxBytes } from '../../main/extract/docxParse.js'
import { parseRegisterText } from '../../main/extract/registerParse.js'
import { extractPdfFromBytes } from './pdfExtract.js'

const nowISO = () => new Date().toISOString()
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'doc'
const rid = () => (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2))

// ── IndexedDB (documents / graphs / workstates / files) ─────────────────────────
const DB = 'anchor'
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => { const db = r.result; for (const s of ['documents', 'graphs', 'workstates', 'files']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s) }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
async function tx(store, mode, fn) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const req = fn(t.objectStore(store))
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error)
  })
}
const get = (store, key) => tx(store, 'readonly', (os) => os.get(key))
const put = (store, key, val) => tx(store, 'readwrite', (os) => os.put(val, key))
const getAll = (store) => tx(store, 'readonly', (os) => os.getAll())

// ── work-state helpers (pure copies; store/workState.js is node-only) ────────────
const emptyWS = (id) => ({ documentId: id, graphVersion: 0, updatedAt: nowISO(), nodes: {}, orphans: [] })
function mergeWS(disk, incoming) {
  const nodes = { ...(disk.nodes || {}) }
  for (const [k, v] of Object.entries(incoming.nodes || {})) {
    const cur = nodes[k]
    const newer = !cur || ((v.seq ?? 0) !== (cur.seq ?? 0) ? (v.seq ?? 0) > (cur.seq ?? 0) : (v.updatedAt || '') >= (cur.updatedAt || ''))
    if (newer) nodes[k] = v
  }
  return { ...disk, ...incoming, nodes, orphans: incoming.orphans ?? disk.orphans ?? [] }
}

// ── demo seed ───────────────────────────────────────────────────────────────────
async function seedDemo() {
  if (await get('documents', 'demo')) return
  try {
    const [g, d, w] = await Promise.all([
      import('../../../resources/demo/graph.json'),
      import('../../../resources/demo/document.json'),
      import('../../../resources/demo/work-state.json')
    ])
    await put('documents', 'demo', d.default)
    await put('graphs', 'demo', g.default)
    await put('workstates', 'demo', w.default)
  } catch { /* ignore */ }
}

async function uniqueId(base) { let id = base, n = 2; while (await get('documents', id)) id = `${base}-${n++}`; return id }

// ── job bus ───────────────────────────────────────────────────────────────────
const jobStore = new Map()
const listeners = new Map()
function emitJob(jobId, job) { jobStore.set(jobId, job); (listeners.get(jobId) || []).forEach((cb) => { try { cb(job) } catch { /* ignore */ } }) }

async function runBuild(id) {
  const jobId = `job-${id}-${rid()}`
  const job = { id: jobId, documentId: id, type: 'build', status: 'running', progress: { phase: 'extract', pct: 8, message: 'Starting…' }, steps: [], startedAt: nowISO(), endedAt: null, error: null }
  emitJob(jobId, { ...job })
  const prog = (phase, pct, message, extra = {}) => { job.progress = { phase, pct, message, ...extra }; emitJob(jobId, { ...job }) }

  ;(async () => {
    try {
      const doc = await get('documents', id)
      const files = (await get('files', id)) || {}
      prog('extract', 14, 'Reading your documents…')
      let pdf = { pages: [], textLayer: true }
      if (files.pdf) pdf = await extractPdfFromBytes(files.pdf)
      let docx = { footnotes: [], paragraphs: [], warnings: [] }
      if (files.docx) docx = parseDocxBytes(files.docx)
      let register = { sources: [] }
      if (files.register) register = parseRegisterText(typeof files.register === 'string' ? files.register : new TextDecoder().decode(files.register))
      const scanned = pdf.textLayer === false

      prog('graph', 48, 'Mapping citations to sources…')
      const graphVersion = (doc.graphVersion || 0) + 1
      let graph = buildGraph({ pdf, docx, register, documentId: id, graphVersion, now: nowISO() })

      prog('anchor', 68, 'Locating each claim on its page…')
      graph = anchorClaims(graph, pdf.pages)
      addPageEdges(graph)
      const warnings = [...(docx.warnings || [])]
      if (scanned) warnings.push('scanned-pdf')
      if (!(files.pdf && files.docx)) warnings.push('single-file')
      graph.inputs = { docx: doc.inputs.docx, pdf: doc.inputs.pdf, register: doc.inputs.register, textLayer: !scanned, warnings }
      await put('graphs', id, graph)

      doc.status = 'ready'; doc.graphVersion = graphVersion; doc.stats = graph.stats
      doc.flags = { textLayer: !scanned, scanned, singleFile: !(files.pdf && files.docx) }; doc.updatedAt = nowISO()
      await put('documents', id, doc)

      const ws = (await get('workstates', id)) || emptyWS(id)
      const { workState } = reconcileWorkState(ws, graph)
      await put('workstates', id, workState)

      job.status = 'done'; job.endedAt = nowISO(); prog('done', 100, 'Done')
    } catch (e) {
      const doc = await get('documents', id).catch(() => null)
      if (doc) { doc.status = 'failed'; await put('documents', id, doc) }
      job.status = 'failed'; job.endedAt = nowISO(); job.error = String(e?.message || e); emitJob(jobId, { ...job })
    }
  })()

  return { jobId }
}

const blobUrls = new Map()
async function pdfUrl(id) {
  if (blobUrls.has(id)) return blobUrls.get(id)
  const files = await get('files', id)
  if (!files?.pdf) return ''
  const url = URL.createObjectURL(new Blob([files.pdf], { type: 'application/pdf' }))
  blobUrls.set(id, url)
  return url
}

export function createWebBackend() {
  return {
    platform: 'web',
    web: true,
    documents: {
      async list() { await seedDemo(); const docs = (await getAll('documents')) || []; return docs.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)) },
      async create({ title }) {
        const id = await uniqueId(slug(title || 'untitled')); const now = nowISO()
        const doc = { id, title: title || 'Untitled report', status: 'new', createdAt: now, updatedAt: now, graphVersion: 0, inputs: { docx: null, pdf: null, register: null }, stats: {}, ai: { used: false, engine: null, lastUsedAt: null }, flags: { textLayer: true, scanned: false, singleFile: false }, isDemo: false }
        await put('documents', id, doc); return doc
      },
      async get(id) { return (await get('documents', id)) || null },
      async getGraph(id) { return (await get('graphs', id)) || null },
      async getWorkState(id) {
        const graph = await get('graphs', id)
        let ws = (await get('workstates', id)) || emptyWS(id)
        let reconciled = false, orphanCount = 0
        if (graph && ws.graphVersion !== graph.graphVersion) { const r = reconcileWorkState(ws, graph); ws = r.workState; orphanCount = r.orphanCount; reconciled = true; await put('workstates', id, ws) }
        return { workState: ws, reconciled, orphanCount }
      },
      async saveWorkState(id, ws) { const disk = (await get('workstates', id)) || emptyWS(id); await put('workstates', id, mergeWS(disk, ws)); return { ok: true } },
      async saveFiles(id, files) {
        const stored = (await get('files', id)) || {}; const doc = await get('documents', id); const inputs = { ...doc.inputs }; const saved = []
        for (const role of ['pdf', 'docx', 'register']) {
          const f = files[role]; if (!f) continue
          stored[role] = role === 'register' ? (typeof f.bytes === 'string' ? f.bytes : new TextDecoder().decode(new Uint8Array(f.bytes))) : new Uint8Array(f.bytes)
          inputs[role] = f.name; saved.push(role)
        }
        await put('files', id, stored); blobUrls.delete(id)
        doc.inputs = inputs; doc.updatedAt = nowISO(); await put('documents', id, doc)
        return { saved, flags: { singleFile: !(inputs.pdf && inputs.docx) } }
      },
      build: (id) => runBuild(id),
      async enhance() { return { jobId: 'noai' } }
    },
    jobs: {
      async get(jobId) { return jobStore.get(jobId) || null },
      onProgress(jobId, cb) { const arr = listeners.get(jobId) || []; arr.push(cb); listeners.set(jobId, arr); return () => listeners.set(jobId, (listeners.get(jobId) || []).filter((x) => x !== cb)) }
    },
    ai: {
      async detect() { return { claude: { present: false, signedIn: false }, codex: { present: false, signedIn: false } } },
      async test() { return { ok: false, message: 'AI suggestions need the desktop app. Standard review works fully here.' } },
      async consent() { return { ok: true } }
    },
    assets: { pdfUrl, async registerUrl() { return '' } },
    setup: {
      async checkDeps() { return { node: { ok: false }, claude: { ok: false, signedIn: false }, codex: { ok: false, signedIn: false }, install: {} } },
      async runStep() { return { ok: false, message: '' } },
      onLog() { return () => {} }
    },
    handoff: { async export() { return { path: '(downloaded)' } } }
  }
}
