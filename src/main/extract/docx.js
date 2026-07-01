// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Deterministic DOCX extraction: paragraphs + footnotes, with footnote display
// numbers renumbered by first-reference order (not raw w:id) and paragraph
// footnoteRefs rewritten from wid -> display number to match.
import { readFileSync } from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false })

const CROSS_REF_RE = /\b(supra|infra|see (above|below)|§|section)\b/i
const CITATION_TOKEN_RE = /\d|https?:\/\/|www\.|§|\bv\.\b/i
const NOTE_MAX_LEN = 30

// preserveOrder nodes look like { 'w:p': [...children], ':@'?: {attrs} } — the tag
// name is whatever key isn't ':@'.
function tagName(node) {
  return Object.keys(node).find((k) => k !== ':@')
}

function attr(node, name) {
  return node[':@'] ? node[':@'][name] : undefined
}

function children(node) {
  const tag = tagName(node)
  const c = node[tag]
  return Array.isArray(c) ? c : []
}

/**
 * Recursively walk a preserveOrder node list, collecting visible run text and
 * footnoteReference ids (in document order) and flagging tracked-changes markup.
 * - <w:t> contributes its text.
 * - <w:delText> (tracked deletions) is skipped entirely.
 * - Everything else (w:r, w:hyperlink, w:smartTag, w:ins, fields, ...) is descended
 *   into generically, so nothing structural has to be special-cased by name.
 * @param {Array} nodes
 * @param {{text:string, footnoteWids:string[], trackedChanges:boolean}} acc
 */
function walk(nodes, acc) {
  if (!Array.isArray(nodes)) return
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (Object.prototype.hasOwnProperty.call(node, '#text')) {
      acc.text += node['#text']
      continue
    }
    const tag = tagName(node)
    if (!tag) continue
    if (tag === 'w:delText') continue // tracked deletion: excluded from output text
    if (tag === 'w:del' || tag === 'w:ins') acc.trackedChanges = true
    if (tag === 'w:footnoteReference') {
      const wid = attr(node, '@_w:id')
      if (wid !== undefined) acc.footnoteWids.push(String(wid))
    }
    walk(children(node), acc)
  }
}

function runText(nodes) {
  const acc = { text: '', footnoteWids: [], trackedChanges: false }
  walk(nodes, acc)
  return acc
}

function classifyRole(text) {
  const trimmed = String(text || '').trim()
  if (CROSS_REF_RE.test(trimmed)) return 'cross-reference'
  if (trimmed.length < NOTE_MAX_LEN && !CITATION_TOKEN_RE.test(trimmed)) return 'note'
  return 'support'
}

/** Find the first top-level element in a preserveOrder document whose tag matches. */
function findElement(nodes, tag) {
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (node && typeof node === 'object' && tagName(node) === tag) return node
  }
  return null
}

/** Optional w:pStyle val from a paragraph's w:pPr, if present. */
function paragraphStyle(pNode) {
  const pPr = findElement(children(pNode), 'w:pPr')
  if (!pPr) return undefined
  const pStyle = findElement(children(pPr), 'w:pStyle')
  if (!pStyle) return undefined
  const val = attr(pStyle, '@_w:val')
  return val !== undefined ? String(val) : undefined
}

/** Depth-first search for the first element anywhere in the tree with the given tag. */
function findDeep(nodes, tag) {
  if (!Array.isArray(nodes)) return null
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue
    if (tagName(node) === tag) return node
    const found = findDeep(children(node), tag)
    if (found) return found
  }
  return null
}

function hasTrackedChanges(nodes) {
  const acc = { text: '', footnoteWids: [], trackedChanges: false }
  walk(nodes, acc)
  return acc.trackedChanges
}

function parseDocumentXml(xml) {
  const root = parser.parse(xml)
  const documentEl = findElement(root, 'w:document')
  const body = documentEl ? findElement(children(documentEl), 'w:body') : null
  const paragraphEls = body ? children(body).filter((n) => n && typeof n === 'object' && tagName(n) === 'w:p') : []

  const paragraphs = []
  const wids = [] // wid -> display number map source: first-occurrence order across the whole body
  const seen = new Set()

  paragraphEls.forEach((p, index) => {
    const { text, footnoteWids } = runText(children(p))
    for (const wid of footnoteWids) {
      if (!seen.has(wid)) { seen.add(wid); wids.push(wid) }
    }
    const paraId = attr(p, '@_w14:paraId') || `pidx${index}`
    const style = paragraphStyle(p)
    paragraphs.push({ paraId, index, text, footnoteWids, style })
  })

  return {
    paragraphs,
    referencedWids: wids,
    trackedChanges: hasTrackedChanges(body ? children(body) : [])
  }
}

function parseFootnotesXml(xml) {
  const root = parser.parse(xml)
  const footnotesEl = findElement(root, 'w:footnotes')
  const footnoteEls = footnotesEl ? children(footnotesEl).filter((n) => n && typeof n === 'object' && tagName(n) === 'w:footnote') : []

  const footnotes = []
  let trackedChanges = false
  for (const fn of footnoteEls) {
    const type = attr(fn, '@_w:type')
    if (type === 'separator' || type === 'continuationSeparator') continue
    const wid = attr(fn, '@_w:id')
    const { text, trackedChanges: tc } = runText(children(fn))
    if (tc) trackedChanges = true
    footnotes.push({ wid: String(wid), rawText: text })
  }
  return { footnotes, trackedChanges }
}

/**
 * @param {string} docxPath
 * @returns {Promise<{footnotes: Array, paragraphs: Array, warnings: string[]}>}
 */
export async function extractDocx(docxPath) {
  let buf
  try {
    buf = readFileSync(docxPath)
  } catch (err) {
    throw new Error(`Could not read DOCX at "${docxPath}": ${err.message}`)
  }

  let zip
  try {
    zip = unzipSync(new Uint8Array(buf))
  } catch (err) {
    throw new Error(`Could not open "${docxPath}" as a zip/DOCX: ${err.message}`)
  }

  const documentEntry = zip['word/document.xml']
  if (!documentEntry) throw new Error(`"${docxPath}" has no word/document.xml — not a valid DOCX.`)

  const documentXml = strFromU8(documentEntry)
  const { paragraphs: rawParagraphs, referencedWids, trackedChanges: docTrackedChanges } = parseDocumentXml(documentXml)

  let rawFootnotes = []
  let footnotesTrackedChanges = false
  const footnotesEntry = zip['word/footnotes.xml']
  if (footnotesEntry) {
    const parsedFootnotes = parseFootnotesXml(strFromU8(footnotesEntry))
    rawFootnotes = parsedFootnotes.footnotes
    footnotesTrackedChanges = parsedFootnotes.trackedChanges
  }

  // Display number = ordinal of first reference occurrence scanning the document body
  // in order. Footnotes that exist but are never referenced are numbered afterward,
  // in the order they appear in footnotes.xml.
  const displayNumberByWid = new Map()
  referencedWids.forEach((wid, i) => displayNumberByWid.set(wid, i + 1))
  let nextUnreferenced = referencedWids.length + 1
  for (const fn of rawFootnotes) {
    if (!displayNumberByWid.has(fn.wid)) {
      displayNumberByWid.set(fn.wid, nextUnreferenced)
      nextUnreferenced += 1
    }
  }

  const footnotes = rawFootnotes
    .map((fn) => ({
      wid: fn.wid,
      number: displayNumberByWid.get(fn.wid),
      rawText: fn.rawText,
      role: classifyRole(fn.rawText)
    }))
    .sort((a, b) => a.number - b.number)

  const paragraphs = rawParagraphs.map((p) => {
    const out = {
      paraId: p.paraId,
      index: p.index,
      text: p.text,
      footnoteRefs: p.footnoteWids
        .map((wid) => displayNumberByWid.get(wid))
        .filter((n) => typeof n === 'number')
    }
    if (p.style !== undefined) out.style = p.style
    return out
  })

  const warnings = []
  if (zip['word/endnotes.xml']) warnings.push('endnotes-found')
  if (docTrackedChanges || footnotesTrackedChanges) warnings.push('tracked-changes')

  return { footnotes, paragraphs, warnings }
}
