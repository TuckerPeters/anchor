// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Mock CLI agent used ONLY by tests. Stands in for `claude -p --output-format json ...`
// and `codex exec --json -` so invokeAgent()/extractJson() can be exercised without ever
// spending real quota or depending on a signed-in local install. Behavior is selected via
// the MOCK_MODE env var. Reads all of stdin first (mirrors how the real CLIs consume the
// prompt) so large (>32KB) prompts flow through without deadlocking the parent's pipe.

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(data))
  })
}

function extractIds(text) {
  const ids = []
  const re = /"id"\s*:\s*"([^"]+)"/g
  let m
  while ((m = re.exec(text))) ids.push(m[1])
  return [...new Set(ids)]
}

function buildItems(ids) {
  return ids.map((id) => ({
    id,
    class: 'paper',
    citationNeed: 'Add a pin cite to the exact page or paragraph supporting this claim.',
    confidence: 0.87
  }))
}

async function main() {
  const mode = process.env.MOCK_MODE || 'claude-good'

  if (mode === 'timeout') {
    // Never exits on its own within any reasonable test timeout; the parent must kill it.
    await new Promise(() => {})
    return
  }

  if (mode === 'exit1') {
    process.stderr.write('mock-agent: simulated failure\n')
    process.exitCode = 1
    return
  }

  const input = await readStdin()
  const ids = extractIds(input)
  const items = buildItems(ids)
  const payload = { items }

  if (mode === 'claude-good') {
    const envelope = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: '```json\n' + JSON.stringify(payload) + '\n```',
      session_id: 'mock-session',
      total_cost_usd: 0.001
    }
    process.stdout.write(JSON.stringify(envelope))
    return
  }

  if (mode === 'claude-chatty') {
    const envelope = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result:
        'Sure! Here is the JSON you requested:\n\n```json\n' +
        JSON.stringify(payload) +
        '\n```\n\nLet me know if you need anything else.',
      session_id: 'mock-session',
      total_cost_usd: 0.001
    }
    process.stdout.write(JSON.stringify(envelope))
    return
  }

  if (mode === 'claude-broken') {
    const envelope = {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'not json at all',
      session_id: 'mock-session',
      total_cost_usd: 0.001
    }
    process.stdout.write(JSON.stringify(envelope))
    return
  }

  if (mode === 'claude-error') {
    const envelope = {
      type: 'result',
      subtype: 'error',
      is_error: true,
      result: null,
      session_id: 'mock-session',
      total_cost_usd: 0.0
    }
    process.stdout.write(JSON.stringify(envelope))
    return
  }

  if (mode === 'codex-good') {
    const lines = [
      { type: 'item.started', item: { type: 'agent_message' } },
      { type: 'item.completed', item: { type: 'agent_message', text: JSON.stringify(payload) } }
    ]
    process.stdout.write(lines.map((l) => JSON.stringify(l)).join('\n'))
    return
  }

  if (mode === 'codex-broken') {
    const lines = [
      { type: 'item.started', item: { type: 'agent_message' } },
      { type: 'item.completed', item: { type: 'agent_message', text: 'not json at all' } }
    ]
    process.stdout.write(lines.map((l) => JSON.stringify(l)).join('\n'))
    return
  }

  // Unknown mode: echo the input back so failures are obvious in test output.
  process.stdout.write(input)
}

main()
