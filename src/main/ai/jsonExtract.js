// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Extracts a JSON payload out of raw CLI stdout. Two engines, two envelope shapes:
//   claude -p --output-format json  -> a single envelope object; the model's own text
//                                      (often ```json fenced) lives at envelope.result.
//   codex exec --json -             -> JSONL events; the final answer is the text/message
//                                      of the LAST agent_message event.
// Never throws. Returns null when nothing usable can be parsed.

/**
 * Best-effort JSON extraction from free-form model text: raw JSON, a ```json fenced
 * block, or (as a last resort) the last balanced {...}/[...] found in the text.
 * @param {string} text
 * @returns {object|Array|null}
 */
export function extractJsonFromText(text) {
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null

  const whole = tryParse(trimmed)
  if (isJsonValue(whole)) return whole

  const fenced = findLastFencedJson(text)
  if (fenced) {
    const parsed = tryParse(fenced)
    if (isJsonValue(parsed)) return parsed
  }

  const scanned = findLastBalancedJson(text)
  if (scanned) {
    const parsed = tryParse(scanned)
    if (isJsonValue(parsed)) return parsed
  }

  return null
}

/**
 * @param {'claude'|'codex'|string} engine
 * @param {string} rawStdout
 * @returns {object|Array|null}
 */
export function extractJson(engine, rawStdout) {
  try {
    if (typeof rawStdout !== 'string' || !rawStdout.trim()) return null
    if (engine === 'codex') return extractFromCodex(rawStdout)
    return extractFromClaude(rawStdout)
  } catch {
    try {
      return extractJsonFromText(rawStdout)
    } catch {
      return null
    }
  }
}

function extractFromClaude(rawStdout) {
  const envelope = tryParse(rawStdout.trim())
  if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
    if (envelope.is_error) return null
    if (typeof envelope.result === 'string') return extractJsonFromText(envelope.result)
    return null
  }
  // Envelope wasn't clean JSON (e.g. warnings printed before it) — fall back to scanning
  // the raw stdout directly.
  return extractJsonFromText(rawStdout)
}

function extractFromCodex(rawStdout) {
  const lines = rawStdout.split(/\r?\n/)
  let lastText = null
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const evt = tryParse(t)
    if (!evt) continue
    const text = pullAgentMessageText(evt)
    if (typeof text === 'string') lastText = text
  }
  if (lastText != null) return extractJsonFromText(lastText)
  return extractJsonFromText(rawStdout)
}

function pullAgentMessageText(evt) {
  if (!evt || typeof evt !== 'object') return null
  // {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
  if (evt.item && evt.item.type === 'agent_message' && typeof evt.item.text === 'string') {
    return evt.item.text
  }
  // {"msg":{"type":"agent_message","message":"..."}}
  if (evt.msg && evt.msg.type === 'agent_message' && typeof evt.msg.message === 'string') {
    return evt.msg.message
  }
  // {"type":"agent_message","text":"..."} / {"type":"agent_message","message":"..."}
  if (evt.type === 'agent_message') {
    if (typeof evt.text === 'string') return evt.text
    if (typeof evt.message === 'string') return evt.message
  }
  return null
}

function tryParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function isJsonValue(v) {
  return v !== null && typeof v === 'object'
}

function findLastFencedJson(text) {
  const re = /```json\s*([\s\S]*?)```/gi
  let match
  let last = null
  while ((match = re.exec(text))) {
    last = match[1]
  }
  return last ? last.trim() : null
}

// Scans for the last top-level, balanced {...} or [...] span in the text, respecting
// double-quoted JSON strings (with backslash escapes) so braces inside string values
// don't throw off the count.
function findLastBalancedJson(text) {
  const stack = []
  let bestStart = -1
  let bestEnd = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{' || ch === '[') {
      stack.push({ ch, i })
      continue
    }

    if (ch === '}' || ch === ']') {
      if (stack.length === 0) continue
      const top = stack.pop()
      const expected = top.ch === '{' ? '}' : ']'
      if (ch !== expected) {
        // Mismatched bracket: this span is malformed. Reset and keep scanning.
        stack.length = 0
        continue
      }
      if (stack.length === 0) {
        bestStart = top.i
        bestEnd = i
      }
    }
  }

  if (bestStart === -1) return null
  return text.slice(bestStart, bestEnd + 1)
}
