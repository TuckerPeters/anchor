// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { docsRoot, docDir, docFile } from './paths.js'
import { slug } from '../graph/ids.js'

function nextId(root, base) {
  let id = base
  let n = 2
  while (existsSync(docDir(root, id))) { id = `${base}-${n++}` }
  return id
}

/**
 * @param {string} root userData root
 * @param {{title:string, now?:string, isDemo?:boolean, id?:string}} opts
 * @returns {import('../../../shared/types.js').Document}
 */
export function createDocument(root, { title, now = new Date().toISOString(), isDemo = false, id = null }) {
  mkdirSync(docsRoot(root), { recursive: true })
  const docId = id || nextId(root, slug(title))
  const doc = {
    id: docId,
    title,
    status: 'new',
    createdAt: now,
    updatedAt: now,
    graphVersion: 0,
    inputs: { docx: null, pdf: null, register: null },
    stats: {},
    ai: { used: false, engine: null, lastUsedAt: null },
    flags: { textLayer: true, scanned: false, singleFile: false },
    isDemo
  }
  mkdirSync(docDir(root, docId), { recursive: true })
  writeFileSync(docFile(root, docId), JSON.stringify(doc, null, 2))
  return doc
}

export function getDocument(root, id) {
  return JSON.parse(readFileSync(docFile(root, id), 'utf8'))
}

export function updateDocument(root, id, patch, now = new Date().toISOString()) {
  const doc = getDocument(root, id)
  const next = { ...doc, ...patch, updatedAt: now }
  writeFileSync(docFile(root, id), JSON.stringify(next, null, 2))
  return next
}

export function listDocuments(root) {
  const base = docsRoot(root)
  if (!existsSync(base)) return []
  return readdirSync(base)
    .filter((d) => existsSync(docFile(root, d)))
    .map((d) => getDocument(root, d))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
}
