// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDocument, listDocuments, getDocument, updateDocument } from '../../../src/main/store/documents.js'

let root
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'anchor-')) })

it('creates a document with the full shape', () => {
  const d = createDocument(root, { title: 'Andersen Report', now: '2026-06-30T00:00:00Z' })
  expect(d.id).toMatch(/^[a-z0-9-]+$/)
  expect(d.status).toBe('new')
  expect(d.graphVersion).toBe(0)
  expect(d.ai).toEqual({ used: false, engine: null, lastUsedAt: null })
  expect(d.flags).toEqual({ textLayer: true, scanned: false, singleFile: false })
  const disk = JSON.parse(readFileSync(join(root, 'documents', d.id, 'document.json'), 'utf8'))
  expect(disk.title).toBe('Andersen Report')
})

it('lists newest-first and gets by id', () => {
  const a = createDocument(root, { title: 'A', now: '2026-06-30T00:00:00Z' })
  createDocument(root, { title: 'B', now: '2026-06-30T01:00:00Z' })
  expect(listDocuments(root).map((d) => d.title)).toEqual(['B', 'A'])
  expect(getDocument(root, a.id).title).toBe('A')
})

it('updates a document and bumps updatedAt', () => {
  const a = createDocument(root, { title: 'A', now: '2026-06-30T00:00:00Z' })
  const u = updateDocument(root, a.id, { status: 'ready' }, '2026-06-30T02:00:00Z')
  expect(u.status).toBe('ready')
  expect(u.updatedAt).toBe('2026-06-30T02:00:00Z')
})
