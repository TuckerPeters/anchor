// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { buildQueue, coverage } from './workflow.js'

const pageNum = (it) => it.claims[0]?.pageId?.replace('p', '') || '?'

/** A readable handoff report the next reviewer can actually use — blocked first, findings kept. */
export function buildHandoffMarkdown(doc, graph, ws) {
  const q = buildQueue(graph, ws)
  const cov = coverage(graph, ws)
  const nodeOf = (id) => ws.nodes?.[id] || {}
  const dateStr = new Date().toISOString().slice(0, 10)

  const blocked = q.filter((it) => it.status === 'blocked')
  const open = q.filter((it) => it.status === 'todo' || it.status === 'in-progress')
  const done = q.filter((it) => it.status === 'done')

  const item = (it) => {
    const n = nodeOf(it.nodeId)
    const claim = it.claims[0]?.text ? `\n  - Claim: ${it.claims[0].text}` : ''
    const src = it.source ? `\n  - Source: ${it.source.title || it.source.key}` : ''
    const found = n.resolution ? `\n  - Found: ${n.resolution}` : ''
    const note = n.note ? `\n  - Note: ${n.note}` : ''
    return `- **Footnote ${it.footnote.number}** (page ${pageNum(it)})${claim}${src}${found}${note}`
  }

  const lines = []
  lines.push(`# ${doc?.title || 'Report'} — Citation Review Handoff`)
  lines.push('')
  lines.push(`Generated ${dateStr} with Anchor.`)
  lines.push('')
  lines.push(`**Coverage:** ${cov.done} of ${cov.total} citations resolved · ${blocked.length} blocked · ${open.length} still open.`)
  lines.push('')
  if (blocked.length) {
    lines.push('## Blocked — needs a decision')
    for (const it of blocked) lines.push(item(it))
    lines.push('')
  }
  if (open.length) {
    lines.push('## Still to review')
    for (const it of open) lines.push(item(it))
    lines.push('')
  }
  lines.push('## Resolved')
  if (done.length) for (const it of done) lines.push(item(it))
  else lines.push('_None yet._')
  lines.push('')
  return lines.join('\n')
}

export function download(filename, text, mime = 'text/markdown') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
