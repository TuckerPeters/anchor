// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { describe, it, expect, afterEach } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { invokeAgent } from '../../../src/main/ai/invoke.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = path.resolve(here, '../../fixtures/mock-agent.mjs')

afterEach(() => {
  delete process.env.MOCK_MODE
})

describe('invokeAgent — mock CLI plumbing', () => {
  it('resolves ok:true with the full stdout text when the mock CLI exits 0', async () => {
    process.env.MOCK_MODE = 'claude-good'
    const res = await invokeAgent('claude', JSON.stringify({ items: [{ id: 'f1' }] }), {
      cmd: 'node',
      args: [fixture],
      timeoutMs: 10000
    })
    expect(res.ok).toBe(true)
    expect(typeof res.text).toBe('string')
    const envelope = JSON.parse(res.text)
    expect(envelope.is_error).toBe(false)
    expect(envelope.result).toContain('f1')
  })

  it('resolves ok:false with stderr as the error when the mock CLI exits non-zero', async () => {
    process.env.MOCK_MODE = 'exit1'
    const res = await invokeAgent('claude', 'hello', { cmd: 'node', args: [fixture], timeoutMs: 10000 })
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/simulated failure/)
  })

  it('never throws when the binary does not exist', async () => {
    const res = await invokeAgent('claude', 'hello', {
      cmd: '/definitely/not/a/real/binary-xyz',
      args: [],
      timeoutMs: 5000
    })
    expect(res.ok).toBe(false)
    expect(typeof res.error).toBe('string')
  })

  it('kills a wedged process on timeout and resolves ok:false, error "timeout"', async () => {
    process.env.MOCK_MODE = 'timeout'
    const start = Date.now()
    const res = await invokeAgent('claude', 'hello', { cmd: 'node', args: [fixture], timeoutMs: 1500 })
    const elapsed = Date.now() - start

    expect(res.ok).toBe(false)
    expect(res.error).toBe('timeout')
    expect(elapsed).toBeLessThan(6000)

    // Give the SIGTERM/SIGKILL a moment to land, then prove the process group is actually
    // dead — not just abandoned while it keeps running in the background.
    await new Promise((r) => setTimeout(r, 500))
    const ps = execFileSync('ps', ['-eo', 'pid,command']).toString()
    const stillRunning = ps.split('\n').some((line) => line.includes(fixture))
    expect(stillRunning).toBe(false)
  }, 15000)

  it('honors an AbortSignal by killing the process and resolving ok:false', async () => {
    process.env.MOCK_MODE = 'timeout'
    const controller = new AbortController()
    const promise = invokeAgent('claude', 'hello', {
      cmd: 'node',
      args: [fixture],
      timeoutMs: 30000,
      signal: controller.signal
    })
    setTimeout(() => controller.abort(), 300)
    const res = await promise
    expect(res.ok).toBe(false)
  }, 10000)

  it('sends prompts larger than 32KB through stdin without error', async () => {
    process.env.MOCK_MODE = 'claude-good'
    const bigPrompt = JSON.stringify({
      items: Array.from({ length: 2000 }, (_, i) => ({ id: `f${i}`, rawText: 'x'.repeat(20) }))
    })
    expect(Buffer.byteLength(bigPrompt)).toBeGreaterThan(32 * 1024)

    const res = await invokeAgent('claude', bigPrompt, { cmd: 'node', args: [fixture], timeoutMs: 15000 })
    expect(res.ok).toBe(true)
    const envelope = JSON.parse(res.text)
    expect(envelope.result).toContain('f0')
    expect(envelope.result).toContain('f1999')
  }, 20000)
})
