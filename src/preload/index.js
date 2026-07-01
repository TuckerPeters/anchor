// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { contextBridge, ipcRenderer } from 'electron'

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args)

const api = {
  documents: {
    list: () => invoke('documents:list'),
    create: (opts) => invoke('documents:create', opts),
    get: (id) => invoke('documents:get', id),
    getGraph: (id) => invoke('documents:getGraph', id),
    getWorkState: (id) => invoke('documents:getWorkState', id),
    saveWorkState: (id, ws) => invoke('documents:saveWorkState', id, ws),
    saveFiles: (id, files) => invoke('documents:saveFiles', id, files),
    build: (id) => invoke('documents:build', id),
    enhance: (id, opts) => invoke('documents:enhance', id, opts)
  },
  jobs: {
    get: (jobId, id) => invoke('jobs:get', jobId, id),
    onProgress: (jobId, cb) => {
      const listener = (_e, payload) => { if (payload?.jobId === jobId) cb(payload.job) }
      ipcRenderer.on('job:progress', listener)
      return () => ipcRenderer.removeListener('job:progress', listener)
    }
  },
  ai: {
    detect: () => invoke('ai:detect'),
    test: (engine) => invoke('ai:test', engine),
    consent: (id, opts) => invoke('ai:consent', id, opts)
  },
  assets: {
    pdfUrl: (id) => invoke('assets:pdfUrl', id),
    registerUrl: (id) => invoke('assets:registerUrl', id)
  },
  setup: {
    checkDeps: () => invoke('setup:checkDeps'),
    runStep: (step) => invoke('setup:runStep', step),
    onLog: (cb) => {
      const l = (_e, line) => cb(line)
      ipcRenderer.on('setup:log', l)
      return () => ipcRenderer.removeListener('setup:log', l)
    }
  },
  handoff: {
    export: (id, opts) => invoke('handoff:export', id, opts)
  },
  platform: process.platform
}

contextBridge.exposeInMainWorld('anchor', api)
