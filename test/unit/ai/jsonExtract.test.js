// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { describe, it, expect } from 'vitest'
import { extractJson, extractJsonFromText } from '../../../src/main/ai/jsonExtract.js'

describe('extractJsonFromText', () => {
  it('parses a raw JSON object', () => {
    expect(extractJsonFromText('{"items":[{"id":"f1"}]}')).toEqual({ items: [{ id: 'f1' }] })
  })

  it('parses a ```json fenced block', () => {
    const text = 'Here you go:\n```json\n{"items":[{"id":"f2"}]}\n```\nHope that helps.'
    expect(extractJsonFromText(text)).toEqual({ items: [{ id: 'f2' }] })
  })

  it('picks the LAST fenced block when there are multiple', () => {
    const text = '```json\n{"items":[{"id":"old"}]}\n```\nActually, here:\n```json\n{"items":[{"id":"new"}]}\n```'
    expect(extractJsonFromText(text)).toEqual({ items: [{ id: 'new' }] })
  })

  it('falls back to a balanced-brace scan when there is prose but no fence', () => {
    const text = 'Sure, the result is {"items":[{"id":"f3","class":"paper"}]} — let me know if you need more.'
    expect(extractJsonFromText(text)).toEqual({ items: [{ id: 'f3', class: 'paper' }] })
  })

  it('finds the LAST balanced object when prose contains an earlier brace-like fragment', () => {
    const text = 'Ignore this {not json} note. Final answer: {"items":[{"id":"f4"}]}'
    expect(extractJsonFromText(text)).toEqual({ items: [{ id: 'f4' }] })
  })

  it('handles a top-level array', () => {
    expect(extractJsonFromText('[{"id":"f1"},{"id":"f2"}]')).toEqual([{ id: 'f1' }, { id: 'f2' }])
  })

  it('is not confused by braces inside JSON string values', () => {
    const text = 'prose { "items": [{"id":"f5","citationNeed":"cite the {appendix}"}] } trailing'
    expect(extractJsonFromText(text)).toEqual({ items: [{ id: 'f5', citationNeed: 'cite the {appendix}' }] })
  })

  it('returns null for non-JSON prose', () => {
    expect(extractJsonFromText('not json at all')).toBeNull()
  })

  it('returns null for empty/whitespace input', () => {
    expect(extractJsonFromText('')).toBeNull()
    expect(extractJsonFromText('   \n  ')).toBeNull()
  })

  it('returns null for non-string input without throwing', () => {
    expect(extractJsonFromText(undefined)).toBeNull()
    expect(extractJsonFromText(null)).toBeNull()
    expect(extractJsonFromText(42)).toBeNull()
  })
})

describe('extractJson — claude envelope', () => {
  it('extracts raw JSON from envelope.result', () => {
    const envelope = { type: 'result', is_error: false, result: '{"items":[{"id":"f1"}]}' }
    expect(extractJson('claude', JSON.stringify(envelope))).toEqual({ items: [{ id: 'f1' }] })
  })

  it('extracts a ```json fenced block inside envelope.result', () => {
    const envelope = { type: 'result', is_error: false, result: '```json\n{"items":[{"id":"f2"}]}\n```' }
    expect(extractJson('claude', JSON.stringify(envelope))).toEqual({ items: [{ id: 'f2' }] })
  })

  it('extracts JSON from a chatty envelope.result with prose around the fence', () => {
    const envelope = {
      type: 'result',
      is_error: false,
      result: 'Sure! Here is the JSON:\n\n```json\n{"items":[{"id":"f3"}]}\n```\n\nLet me know if you need anything else.'
    }
    expect(extractJson('claude', JSON.stringify(envelope))).toEqual({ items: [{ id: 'f3' }] })
  })

  it('returns null when envelope.is_error is true', () => {
    const envelope = { type: 'result', is_error: true, result: null }
    expect(extractJson('claude', JSON.stringify(envelope))).toBeNull()
  })

  it('returns null when envelope.result is not JSON-parseable', () => {
    const envelope = { type: 'result', is_error: false, result: 'not json at all' }
    expect(extractJson('claude', JSON.stringify(envelope))).toBeNull()
  })

  it('falls back to scanning raw stdout when it is not a clean envelope', () => {
    const raw = 'warning: something printed first\n{"items":[{"id":"f4"}]}'
    expect(extractJson('claude', raw)).toEqual({ items: [{ id: 'f4' }] })
  })
})

describe('extractJson — codex JSONL', () => {
  it('extracts JSON from the last item.completed agent_message', () => {
    const lines = [
      JSON.stringify({ type: 'item.started', item: { type: 'agent_message' } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"items":[{"id":"f1"}]}' } })
    ].join('\n')
    expect(extractJson('codex', lines)).toEqual({ items: [{ id: 'f1' }] })
  })

  it('uses the LAST agent_message when multiple are present', () => {
    const lines = [
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"items":[{"id":"old"}]}' } }),
      JSON.stringify({ msg: { type: 'agent_message', message: '{"items":[{"id":"new"}]}' } })
    ].join('\n')
    expect(extractJson('codex', lines)).toEqual({ items: [{ id: 'new' }] })
  })

  it('ignores non-JSON lines interspersed in the stream', () => {
    const lines = [
      'not json',
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: '{"items":[{"id":"f2"}]}' } }),
      ''
    ].join('\n')
    expect(extractJson('codex', lines)).toEqual({ items: [{ id: 'f2' }] })
  })

  it('returns null when the last agent_message text is not JSON', () => {
    const lines = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'not json at all' } })
    expect(extractJson('codex', lines)).toBeNull()
  })
})

describe('extractJson — malformed input never throws', () => {
  it('returns null for empty stdout', () => {
    expect(extractJson('claude', '')).toBeNull()
    expect(extractJson('codex', '')).toBeNull()
  })

  it('returns null for garbage stdout', () => {
    expect(extractJson('claude', 'complete garbage, not even close to JSON')).toBeNull()
    expect(extractJson('codex', 'complete garbage, not even close to JSON')).toBeNull()
  })

  it('does not throw for non-string input', () => {
    expect(() => extractJson('claude', undefined)).not.toThrow()
    expect(() => extractJson('codex', null)).not.toThrow()
    expect(extractJson('claude', undefined)).toBeNull()
  })
})
