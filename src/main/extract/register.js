// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Deterministic parsing of a GitHub-style markdown source-register table into
// SourceRaw records. Tolerant of extra/missing columns, column reordering, and
// case in header names.
import { readFileSync } from 'node:fs'

// Header name -> canonical field, matched case-insensitively against the header
// cell with whitespace stripped (so "Local Candidate" and "localCandidate" both hit).
const HEADER_ALIASES = {
  key: 'key', id: 'key',
  class: 'class', type: 'class',
  title: 'title', source: 'title',
  url: 'url', link: 'url',
  local: 'localCandidate', localcandidate: 'localCandidate', file: 'localCandidate',
  audit: 'auditNote', auditnote: 'auditNote', note: 'auditNote',
  need: 'citationNeed', citationneed: 'citationNeed'
}

function normalizeHeaderCell(cell) {
  return String(cell || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c.trim()))
}

/** Split a `| a | b |` markdown table row into trimmed cells, dropping empty edge cells from leading/trailing pipes. */
function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((c) => c.trim())
}

function splitUrls(cell) {
  return String(cell || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {string} md
 * @returns {{sources: Array}}
 */
export function parseRegisterText(md) {
  const lines = String(md || '').split(/\r?\n/)
  const tableLines = lines.filter((l) => l.includes('|'))
  if (tableLines.length === 0) return { sources: [] }

  const headerCells = splitRow(tableLines[0])
  const fieldByColumn = headerCells.map((cell) => HEADER_ALIASES[normalizeHeaderCell(cell)] || null)

  const sources = []
  for (let i = 1; i < tableLines.length; i++) {
    const cells = splitRow(tableLines[i])
    if (isSeparatorRow(cells)) continue
    if (cells.every((c) => c === '')) continue

    const row = {}
    fieldByColumn.forEach((field, idx) => {
      if (field) row[field] = cells[idx] ?? ''
    })

    sources.push({
      key: row.key || '',
      class: row.class || 'note',
      title: row.title || '',
      url: splitUrls(row.url),
      localCandidate: row.localCandidate || '',
      auditNote: row.auditNote || '',
      citationNeed: row.citationNeed || ''
    })
  }

  return { sources }
}

/**
 * @param {string} registerPath
 * @returns {Promise<{sources: Array}>}
 */
export async function parseRegister(registerPath) {
  let text
  try {
    text = readFileSync(registerPath, 'utf8')
  } catch (err) {
    throw new Error(`Could not read register at "${registerPath}": ${err.message}`)
  }
  return parseRegisterText(text)
}
