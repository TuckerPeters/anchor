// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { describe, it, expect } from 'vitest'
import { enhanceGraph } from '../../../src/main/ai/passes.js'

function makeGraph() {
  return {
    documentId: 'doc-1',
    graphVersion: 1,
    stats: {},
    nodes: {
      pages: [],
      claims: [],
      footnotes: [
        { id: 'f1', number: 1, rawText: 'See Smith Report at 12.', class: 'paper', citationNeed: '', ai: null },
        { id: 'f2', number: 2, rawText: 'See https://example.com/x', class: 'web', citationNeed: '', ai: null },
        { id: 'f3', number: 3, rawText: 'See id.', class: 'cross-reference', citationNeed: '', ai: null }
      ],
      sources: [],
      targets: []
    },
    edges: []
  }
}

function claudeEnvelope(result) {
  return { type: 'result', is_error: false, result: '```json\n' + JSON.stringify(result) + '\n```' }
}

// A fake `invoke` that answers deterministically per footnote-id set, so we can script
// good/chatty/broken/timeout behavior per call without touching the real CLI.
function fakeInvokeFactory(script) {
  let call = 0
  const calls = []
  const invoke = async (engine, prompt) => {
    calls.push({ engine, prompt })
    const behavior = script[call] ?? script[script.length - 1]
    call += 1
    return behavior(prompt)
  }
  invoke.calls = calls
  return invoke
}

function classifyGoodResponse(prompt) {
  const ids = [...prompt.matchAll(/"id":"(f\d+)"/g)].map((m) => m[1])
  const items = ids.map((id) => ({ id, class: 'case', confidence: 0.9 }))
  return { ok: true, text: JSON.stringify(claudeEnvelope({ items })) }
}

function citationNeedGoodResponse(prompt) {
  const ids = [...prompt.matchAll(/"id":"(f\d+)"/g)].map((m) => m[1])
  const items = ids.map((id) => ({ id, citationNeed: 'Add a pin cite.', confidence: 0.75 }))
  return { ok: true, text: JSON.stringify(claudeEnvelope({ items })) }
}

function goodResponse(prompt) {
  if (prompt.includes('"class"')) return classifyGoodResponse(prompt)
  return citationNeedGoodResponse(prompt)
}

function chattyResponse(prompt) {
  const good = goodResponse(prompt)
  const parsed = JSON.parse(good.text)
  parsed.result = 'Sure, here it is:\n\n' + parsed.result + '\n\nLet me know if you need more.'
  return { ok: true, text: JSON.stringify(parsed) }
}

function brokenResponse() {
  return { ok: true, text: JSON.stringify({ type: 'result', is_error: false, result: 'not json at all' }) }
}

function timeoutResponse() {
  return { ok: false, text: '', error: 'timeout' }
}

describe('enhanceGraph', () => {
  it('applies ai overlays on a good response and never touches deterministic fields', async () => {
    const graph = makeGraph()
    const invoke = fakeInvokeFactory([goodResponse])

    const result = await enhanceGraph(graph, { engine: 'claude', invoke, chunkSize: 15 })

    for (const fn of result.nodes.footnotes) {
      expect(fn.ai).toBeTruthy()
      expect(fn.ai.engine).toBe('claude')
    }
    const f1 = result.nodes.footnotes.find((f) => f.id === 'f1')
    expect(f1.ai.class).toBe('case')
    expect(f1.ai.citationNeed).toBe('Add a pin cite.')

    // Deterministic fields must be byte-identical to the input, on both the original
    // object and a value comparison against a fresh copy.
    const original = makeGraph()
    for (let i = 0; i < original.nodes.footnotes.length; i++) {
      expect(result.nodes.footnotes[i].class).toBe(original.nodes.footnotes[i].class)
      expect(result.nodes.footnotes[i].citationNeed).toBe(original.nodes.footnotes[i].citationNeed)
    }
    // And the input graph object itself was not mutated (enhanceGraph deep-clones).
    expect(graph.nodes.footnotes[0].ai).toBeNull()
  })

  it('handles a chatty response (prose + fenced JSON) the same as a clean one', async () => {
    const graph = makeGraph()
    const invoke = fakeInvokeFactory([chattyResponse])

    const result = await enhanceGraph(graph, { engine: 'claude', invoke })

    const f1 = result.nodes.footnotes.find((f) => f.id === 'f1')
    expect(f1.ai.class).toBe('case')
  })

  it('degrades gracefully on a broken response (retries once, then skips) without throwing', async () => {
    const graph = makeGraph()
    const messages = []
    const invoke = fakeInvokeFactory([brokenResponse, brokenResponse])

    let result
    await expect(
      (async () => {
        result = await enhanceGraph(graph, {
          engine: 'claude',
          invoke,
          onProgress: (p) => messages.push(p)
        })
      })()
    ).resolves.not.toThrow()

    // No ai overlay was applied because every attempt was unparseable.
    for (const fn of result.nodes.footnotes) {
      expect(fn.ai).toBeNull()
    }
    // Retried once per chunk per pass (2 passes x 1 chunk x 2 attempts = 4 calls).
    expect(invoke.calls.length).toBe(4)
    expect(messages.some((m) => String(m.message).includes('degraded'))).toBe(true)
  })

  it('degrades gracefully on a timeout response without throwing', async () => {
    const graph = makeGraph()
    const invoke = fakeInvokeFactory([timeoutResponse, timeoutResponse])

    const result = await enhanceGraph(graph, { engine: 'claude', invoke })

    for (const fn of result.nodes.footnotes) {
      expect(fn.ai).toBeNull()
    }
  })

  it('recovers on the retry: first attempt broken, second attempt good', async () => {
    const graph = makeGraph()
    let n = 0
    const invoke = async (engine, prompt) => {
      n += 1
      // Fail the very first call only; every later call (retries, later passes) succeeds.
      if (n === 1) return brokenResponse()
      return goodResponse(prompt)
    }

    const result = await enhanceGraph(graph, { engine: 'claude', invoke })
    const f1 = result.nodes.footnotes.find((f) => f.id === 'f1')
    expect(f1.ai.class).toBe('case')
  })

  it('never throws when the injected invoke itself throws', async () => {
    const graph = makeGraph()
    const invoke = async () => {
      throw new Error('boom')
    }

    await expect(enhanceGraph(graph, { engine: 'claude', invoke })).resolves.toBeTruthy()
    const result = await enhanceGraph(graph, { engine: 'claude', invoke })
    for (const fn of result.nodes.footnotes) expect(fn.ai).toBeNull()
  })

  it('never throws when onProgress itself throws', async () => {
    const graph = makeGraph()
    const invoke = fakeInvokeFactory([goodResponse])
    const onProgress = () => {
      throw new Error('progress callback exploded')
    }

    await expect(enhanceGraph(graph, { engine: 'claude', invoke, onProgress })).resolves.toBeTruthy()
  })

  it('calls writeCheckpoint once per chunk per pass', async () => {
    const graph = makeGraph()
    const invoke = fakeInvokeFactory([goodResponse])
    const checkpoints = []

    // chunkSize=1 with 3 footnotes and 2 passes => 3 chunks/pass x 2 passes = 6 checkpoints.
    await enhanceGraph(graph, {
      engine: 'claude',
      invoke,
      chunkSize: 1,
      writeCheckpoint: (payload) => checkpoints.push(payload)
    })

    expect(checkpoints.length).toBe(6)
    expect(checkpoints.every((c) => typeof c.pass === 'string' && typeof c.chunkCursor === 'number')).toBe(true)
  })

  it('returns an empty-but-valid graph unchanged when there are no footnotes', async () => {
    const graph = makeGraph()
    graph.nodes.footnotes = []
    const invoke = fakeInvokeFactory([goodResponse])

    const result = await enhanceGraph(graph, { engine: 'claude', invoke })
    expect(result.nodes.footnotes).toEqual([])
    expect(invoke.calls.length).toBe(0)
  })

  it('handles a null/malformed graph without throwing', async () => {
    const invoke = fakeInvokeFactory([goodResponse])
    await expect(enhanceGraph({}, { engine: 'claude', invoke })).resolves.toBeTruthy()
    await expect(enhanceGraph({ nodes: {} }, { engine: 'claude', invoke })).resolves.toBeTruthy()
  })
})
