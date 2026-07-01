// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Thin wrapper over the preload `window.anchor` API. When running in a plain browser
// (npm run web, for visual QA), falls back to an in-memory mock backed by the demo doc.

let demoCache = null
async function demo() {
  if (demoCache) return demoCache
  const [g, d, w] = await Promise.all([
    import('../../../resources/demo/graph.json'),
    import('../../../resources/demo/document.json'),
    import('../../../resources/demo/work-state.json')
  ])
  demoCache = { graph: g.default, doc: d.default, ws: w.default }
  return demoCache
}

const WS_KEY = (id) => `anchor-mock-ws-${id}`
const DOCS_KEY = 'anchor-mock-docs'
const readExtra = () => { try { return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]') } catch { return [] } }

function createMock() {
  return {
    platform: 'web',
    documents: {
      async list() { const { doc } = await demo(); return [...readExtra(), doc] },
      async create({ title }) {
        const id = 'doc-' + Math.random().toString(36).slice(2, 8)
        const now = new Date().toISOString()
        const d = { id, title, status: 'new', createdAt: now, updatedAt: now, graphVersion: 0, inputs: { docx: null, pdf: null, register: null }, stats: {}, ai: { used: false, engine: null, lastUsedAt: null }, flags: { textLayer: true, scanned: false, singleFile: false }, isDemo: false }
        localStorage.setItem(DOCS_KEY, JSON.stringify([d, ...readExtra()]))
        return d
      },
      async get(id) { const { doc } = await demo(); return id === doc.id ? doc : (readExtra().find((d) => d.id === id) || null) },
      async getGraph(id) { const { graph, doc } = await demo(); return id === doc.id ? graph : null },
      async getWorkState(id) {
        const raw = localStorage.getItem(WS_KEY(id))
        if (raw) return { workState: JSON.parse(raw), reconciled: false, orphanCount: 0 }
        const { ws, doc } = await demo()
        if (id === doc.id) return { workState: ws, reconciled: false, orphanCount: 0 }
        return { workState: { documentId: id, graphVersion: 0, updatedAt: new Date().toISOString(), nodes: {}, orphans: [] }, reconciled: false, orphanCount: 0 }
      },
      async saveWorkState(id, ws) { localStorage.setItem(WS_KEY(id), JSON.stringify(ws)); return { ok: true } },
      async saveFiles() { return { saved: [], flags: {} } },
      async build() { return { jobId: 'mock' } },
      async enhance() { return { jobId: 'mock' } }
    },
    jobs: { async get() { return null }, onProgress() { return () => {} } },
    ai: {
      async detect() { return { claude: { present: false, signedIn: false }, codex: { present: false, signedIn: false } } },
      async test() { return { ok: false, message: 'Not available in browser preview.' } },
      async consent() { return { ok: true } }
    },
    assets: { async pdfUrl() { return '' }, async registerUrl() { return '' } },
    setup: {
      async checkDeps() { return { node: { ok: true, version: 'web' }, claude: { ok: false, signedIn: false }, codex: { ok: false, signedIn: false }, install: {} } },
      async runStep() { return { ok: false, message: '' } },
      onLog() { return () => {} }
    },
    handoff: { async export() { return { path: '(browser preview)' } } }
  }
}

const real = typeof window !== 'undefined' && window.anchor
export const api = real || createMock()
export const isMock = !real
