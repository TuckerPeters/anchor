// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { ipcMain } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { listDocuments, createDocument, getDocument, updateDocument } from './store/documents.js'
import { loadWorkState, saveWorkState, mergeWorkState } from './store/workState.js'
import { reconcileWorkState } from './store/reconcile.js'
import { graphFile } from './store/paths.js'
import { runBuild } from './jobs/runner.js'
import { detectAgents, testAgent } from './ai/detect.js'

function readGraph(root, id) {
  const f = graphFile(root, id)
  if (!existsSync(f)) return null
  return JSON.parse(readFileSync(f, 'utf8'))
}

/** Register every ipcMain handler. `root` = app.getPath('userData'). `emit(win)` sends events. */
export function registerIpc(root, getWindow) {
  const h = (channel, fn) => ipcMain.handle(channel, (_e, ...args) => fn(...args))

  // --- documents ---
  h('documents:list', () => listDocuments(root))
  h('documents:create', ({ title }) => createDocument(root, { title }))
  h('documents:get', (id) => getDocument(root, id))
  h('documents:getGraph', (id) => readGraph(root, id))

  h('documents:getWorkState', (id) => {
    const graph = readGraph(root, id)
    let ws = loadWorkState(root, id)
    let orphanCount = 0
    let reconciled = false
    if (graph && ws.graphVersion !== graph.graphVersion) {
      const r = reconcileWorkState(ws, graph)
      ws = r.workState
      orphanCount = r.orphanCount
      reconciled = true
      saveWorkState(root, id, ws)
    }
    return { workState: ws, reconciled, orphanCount }
  })

  h('documents:saveWorkState', (id, incoming) => {
    const disk = loadWorkState(root, id)
    const merged = mergeWorkState(disk, incoming)
    saveWorkState(root, id, merged)
    return { ok: true }
  })

  // --- build / enhance (jobs) ---
  h('documents:saveFiles', (id, files) => import('./jobs/ingest.js').then((m) => m.saveFiles(root, id, files)))
  h('documents:build', (id) => runBuild(root, id, { useAI: false }, getWindow))
  h('documents:enhance', (id, opts) => runBuild(root, id, { useAI: true, ...opts }, getWindow))
  h('jobs:get', (jobId, id) => {
    const f = graphFile(root, id).replace('graph.json', `jobs/${jobId}.json`)
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
  })

  // --- ai ---
  h('ai:detect', () => detectAgents())
  h('ai:test', (engine) => testAgent(engine))
  h('ai:consent', (id, { engine }) => updateDocument(root, id, {
    ai: { ...getDocument(root, id).ai, used: true, engine, lastUsedAt: new Date().toISOString() }
  }))

  // --- assets ---
  h('assets:pdfUrl', (id) => `anchor://doc/${id}/pdf`)
  h('assets:registerUrl', (id) => `anchor://doc/${id}/register`)

  // --- setup ---
  h('setup:checkDeps', () => import('./setup/deps.js').then((m) => m.checkDeps()))
  h('setup:runStep', (step) => import('./setup/deps.js').then((m) => m.runStep(step, getWindow)))
}
