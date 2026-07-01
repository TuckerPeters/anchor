// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// AI enhancement pass contracts. Every pass is a pure description of: how to build a
// prompt for a chunk of footnotes, the JSON Schema the model's reply must satisfy, and
// how to apply a validated reply back onto the graph. Passes NEVER touch deterministic
// fields (footnote.class, footnote.citationNeed) — they only ever write to the
// footnote.ai overlay, per the frozen contract in shared/types.js.

// Mirrors the SourceClass typedef in shared/types.js (that file has no runtime exports).
const SOURCE_CLASSES = ['paper', 'docs', 'repo', 'web', 'case', 'screenshot', 'cross-reference', 'missing', 'note']

function compactFootnotes(chunk) {
  return JSON.stringify((chunk || []).map((f) => ({ id: f.id, number: f.number, rawText: f.rawText })))
}

function footnotesById(graph) {
  const list = graph?.nodes?.footnotes
  const map = new Map()
  if (Array.isArray(list)) {
    for (const f of list) map.set(f.id, f)
  }
  return map
}

const classifyPass = {
  key: 'classify',
  buildPrompt(chunk) {
    return [
      'You are classifying footnotes from a legal expert report by source class.',
      `Allowed "class" values: ${SOURCE_CLASSES.join(', ')}.`,
      'For each footnote below, choose exactly one class and a confidence between 0 and 1.',
      'Footnotes (JSON array of {id, number, rawText}):',
      compactFootnotes(chunk),
      'Return ONLY valid JSON matching this exact shape and nothing else:',
      '{"items":[{"id":"<id>","class":"<one of the allowed values>","confidence":<0-1 number>}]}',
      'Return ONLY valid JSON. No prose, no markdown fences.'
    ].join('\n')
  },
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            class: { type: 'string', enum: SOURCE_CLASSES },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['id', 'class', 'confidence']
        }
      }
    },
    required: ['items']
  },
  apply(graph, result) {
    const items = Array.isArray(result?.items) ? result.items : []
    const byId = footnotesById(graph)
    for (const item of items) {
      const footnote = byId.get(item?.id)
      if (!footnote) continue
      footnote.ai = {
        ...(footnote.ai || {}),
        class: item.class,
        confidence: item.confidence,
        engine: result?.engine
      }
    }
  }
}

const citationNeedPass = {
  key: 'citationNeed',
  buildPrompt(chunk) {
    return [
      'You are reviewing footnotes from a legal expert report to identify what citation support is still needed.',
      'For each footnote below, write ONE concrete, actionable instruction describing what still needs to be',
      'sourced or verified, and a confidence between 0 and 1.',
      'Footnotes (JSON array of {id, number, rawText}):',
      compactFootnotes(chunk),
      'Return ONLY valid JSON matching this exact shape and nothing else:',
      '{"items":[{"id":"<id>","citationNeed":"<one concrete instruction>","confidence":<0-1 number>}]}',
      'Return ONLY valid JSON. No prose, no markdown fences.'
    ].join('\n')
  },
  schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            citationNeed: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 }
          },
          required: ['id', 'citationNeed', 'confidence']
        }
      }
    },
    required: ['items']
  },
  apply(graph, result) {
    const items = Array.isArray(result?.items) ? result.items : []
    const byId = footnotesById(graph)
    for (const item of items) {
      const footnote = byId.get(item?.id)
      if (!footnote) continue
      footnote.ai = {
        ...(footnote.ai || {}),
        citationNeed: item.citationNeed,
        confidence: item.confidence,
        engine: result?.engine
      }
    }
  }
}

export const PASSES = [classifyPass, citationNeedPass]
