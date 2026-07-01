// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Orchestrates the AI enhancement passes over a graph's footnotes, chunk by chunk.
// Bulletproof by construction: every agent call, JSON parse, and schema validation is
// wrapped so a single bad chunk degrades (skipped, reported via onProgress) instead of
// aborting the whole run. Deterministic graph fields are never touched — this function
// deep-clones the input graph and passes only ever write to node.ai overlays.
import Ajv from 'ajv'
import { invokeAgent } from './invoke.js'
import { extractJson } from './jsonExtract.js'
import { PASSES } from './contracts.js'

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })
const validatorCache = new Map()

function getValidator(pass) {
  let validate = validatorCache.get(pass.key)
  if (!validate) {
    validate = ajv.compile(pass.schema)
    validatorCache.set(pass.key, validate)
  }
  return validate
}

function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // fall through to JSON clone
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function chunkArray(arr, size) {
  const out = []
  const step = Math.max(1, size || 1)
  for (let i = 0; i < arr.length; i += step) out.push(arr.slice(i, i + step))
  return out
}

function safeCall(fn, payload) {
  try {
    fn?.(payload)
  } catch {
    // A misbehaving progress/checkpoint callback must never break enhancement.
  }
}

function pct(done, total) {
  if (!total) return 100
  return Math.round((done / total) * 100)
}

/**
 * Runs one chunk through the agent once. Never throws — returns { ok, data, error }.
 */
async function tryOnce(engine, invoke, signal, validate, prompt) {
  let res
  try {
    res = await invoke(engine, prompt, { signal })
  } catch (e) {
    return { ok: false, error: 'invoke-threw: ' + String(e?.message || e) }
  }
  if (!res || !res.ok) {
    return { ok: false, error: res?.error || 'invoke-failed' }
  }

  let data
  try {
    data = extractJson(engine, res.text)
  } catch (e) {
    return { ok: false, error: 'extract-threw: ' + String(e?.message || e) }
  }
  if (data == null) return { ok: false, error: 'no-json-found' }

  let valid = false
  try {
    valid = validate(data)
  } catch (e) {
    return { ok: false, error: 'validate-threw: ' + String(e?.message || e) }
  }
  if (!valid) return { ok: false, error: 'schema-invalid' }

  return { ok: true, data }
}

/**
 * @param {object} graph
 * @param {{
 *   engine?: 'claude'|'codex',
 *   invoke?: (engine:string, prompt:string, opts?:object) => Promise<{ok:boolean,text:string,error?:string}>,
 *   onProgress?: (payload:object) => void,
 *   signal?: AbortSignal,
 *   checkpoint?: {pass:string, chunkCursor:number},
 *   writeCheckpoint?: (payload:{pass:string, chunkCursor:number, total:number}) => void,
 *   chunkSize?: number
 * }} [opts]
 * @returns {Promise<object>} a new graph object; deterministic fields are never mutated
 */
export async function enhanceGraph(graph, opts = {}) {
  const {
    engine = 'claude',
    invoke = invokeAgent,
    onProgress,
    signal,
    checkpoint,
    writeCheckpoint,
    chunkSize = 15
  } = opts

  const clonedGraph = deepClone(graph)

  let footnotes
  try {
    footnotes = clonedGraph?.nodes?.footnotes
  } catch {
    footnotes = null
  }
  if (!Array.isArray(footnotes) || footnotes.length === 0) {
    return clonedGraph
  }

  // If resuming, skip whole passes that were already completed and fast-forward into the
  // pass that was mid-flight.
  const resumePassIdx = checkpoint?.pass ? PASSES.findIndex((p) => p.key === checkpoint.pass) : -1

  for (let passIdx = 0; passIdx < PASSES.length; passIdx++) {
    const pass = PASSES[passIdx]
    if (resumePassIdx >= 0 && passIdx < resumePassIdx) continue

    let validate
    try {
      validate = getValidator(pass)
    } catch (e) {
      safeCall(onProgress, { phase: pass.key, pct: 100, message: 'schema-compile-failed: ' + String(e?.message || e) })
      continue
    }

    const chunks = chunkArray(footnotes, chunkSize)
    const total = chunks.length
    const resumeFrom =
      resumePassIdx >= 0 && passIdx === resumePassIdx && typeof checkpoint.chunkCursor === 'number'
        ? checkpoint.chunkCursor + 1
        : 0

    for (let chunkCursor = resumeFrom; chunkCursor < chunks.length; chunkCursor++) {
      if (signal?.aborted) {
        safeCall(onProgress, { phase: pass.key, pct: pct(chunkCursor, total), message: 'aborted' })
        break
      }

      const chunk = chunks[chunkCursor]

      try {
        const prompt = pass.buildPrompt(chunk)
        let attempt = await tryOnce(engine, invoke, signal, validate, prompt)

        if (!attempt.ok) {
          const retryPrompt = prompt + '\nYour previous output was invalid. Return ONLY valid JSON matching the schema.'
          attempt = await tryOnce(engine, invoke, signal, validate, retryPrompt)
        }

        if (attempt.ok) {
          pass.apply(clonedGraph, { ...attempt.data, engine })
        } else {
          safeCall(onProgress, {
            phase: pass.key,
            pct: pct(chunkCursor, total),
            message: `degraded chunk [${chunk.map((f) => f.id).join(',')}]: ${attempt.error}`
          })
        }
      } catch (e) {
        // Belt-and-suspenders: nothing above should throw, but a chunk must never be
        // able to abort the whole enhancement run.
        safeCall(onProgress, {
          phase: pass.key,
          pct: pct(chunkCursor, total),
          message: `degraded chunk [${chunk.map((f) => f?.id).join(',')}]: ` + String(e?.message || e)
        })
      }

      const checkpointPayload = { pass: pass.key, chunkCursor, total }
      safeCall(writeCheckpoint, checkpointPayload)
      safeCall(onProgress, { phase: pass.key, pct: pct(chunkCursor + 1, total), message: `${pass.key} ${chunkCursor + 1}/${total}` })
    }
  }

  return clonedGraph
}
