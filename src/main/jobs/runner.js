// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Job runner: creates a job record, runs the build pipeline, streams progress to the
// renderer, and flips document status. The heavy pipeline lives in ./pipeline.js.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { docDir } from '../store/paths.js'
import { updateDocument } from '../store/documents.js'

let counter = 0
function newJobId() { return `job-${Date.now()}-${counter++}` }

function writeJob(root, id, job) {
  const dir = join(docDir(root, id), 'jobs')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${job.id}.json`), JSON.stringify(job, null, 2))
}

/**
 * Kick off a build (deterministic) or enhance (AI) job. Runs async; the renderer polls
 * jobs:get and listens to job progress events.
 */
export async function runBuild(root, id, opts, getWindow) {
  const jobId = newJobId()
  const job = {
    id: jobId, documentId: id, type: opts.useAI ? 'enhance' : 'build',
    status: 'running', progress: { phase: 'start', pct: 0, message: 'Starting…' },
    steps: [], checkpoint: null, startedAt: new Date().toISOString(), endedAt: null, error: null
  }
  writeJob(root, id, job)

  const emit = (patch) => {
    Object.assign(job, patch)
    if (patch.progress) job.progress = { ...job.progress, ...patch.progress }
    writeJob(root, id, job)
    try { getWindow?.()?.webContents.send(`job:progress`, { jobId, job }) } catch { /* window gone */ }
  }

  ;(async () => {
    try {
      const { runPipeline } = await import('./pipeline.js')
      await runPipeline(root, id, opts, emit)
      emit({ status: 'done', endedAt: new Date().toISOString(), progress: { phase: 'done', pct: 100, message: 'Done' } })
    } catch (e) {
      updateDocument(root, id, { status: 'failed' })
      emit({ status: 'failed', endedAt: new Date().toISOString(), error: String(e?.message || e) })
    }
  })()

  return { jobId }
}
