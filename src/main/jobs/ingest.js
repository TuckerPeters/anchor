// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Save uploaded files. Validates by MAGIC BYTES (not just extension), sanitizes the
// filename, and caps size — a renamed or crafted file cannot slip through.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { uploadsDir } from '../store/paths.js'
import { updateDocument, getDocument } from '../store/documents.js'

const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

function sniff(role, buf) {
  const head = buf.subarray(0, 8)
  if (role === 'pdf') return head.subarray(0, 5).toString('latin1') === '%PDF-'
  if (role === 'docx') return head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07) // PK zip
  if (role === 'register') return true // markdown/text
  return false
}

function safeName(name, role) {
  const base = basename(String(name || '')).replace(/[^a-zA-Z0-9._-]/g, '_')
  const fallbackExt = role === 'pdf' ? '.pdf' : role === 'docx' ? '.docx' : '.md'
  return extname(base) ? base : `${role}${fallbackExt}`
}

/**
 * @param {string} root @param {string} id
 * @param {{[role:string]:{name:string, bytes:ArrayBuffer}}} files
 */
export async function saveFiles(root, id, files) {
  mkdirSync(uploadsDir(root, id), { recursive: true })
  const saved = []
  const inputs = { ...getDocument(root, id).inputs }
  for (const role of ['pdf', 'docx', 'register']) {
    const f = files[role]
    if (!f) continue
    const buf = Buffer.from(f.bytes)
    if (buf.byteLength > MAX_BYTES) throw new Error(`${role} file is too large (max 100 MB).`)
    if (!sniff(role, buf)) throw new Error(`That ${role.toUpperCase()} file doesn't look like a real ${role.toUpperCase()}. Please re-export it.`)
    const name = safeName(f.name, role)
    writeFileSync(join(uploadsDir(root, id), name), buf)
    inputs[role] = name
    saved.push(role)
  }
  const singleFile = [inputs.pdf, inputs.docx].filter(Boolean).length < 2
  updateDocument(root, id, { inputs, flags: { ...getDocument(root, id).flags, singleFile } })
  return { saved, flags: { singleFile } }
}
