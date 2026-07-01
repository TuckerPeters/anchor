// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Install the bundled demo document on first run so a never-coded-before user reaches a
// working review queue in seconds — no import, no setup, no AI.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { docDir, docFile } from '../store/paths.js'

function demoResourceDir() {
  if (process.resourcesPath) {
    const packaged = join(process.resourcesPath, 'demo')
    if (existsSync(packaged)) return packaged
  }
  return join(import.meta.dirname, '..', '..', '..', 'resources', 'demo')
}

export function seedDemoDocument(root) {
  if (existsSync(docFile(root, 'demo'))) return // already present (or user kept it)
  const src = demoResourceDir()
  if (!existsSync(src)) return
  const dst = docDir(root, 'demo')
  mkdirSync(dst, { recursive: true })
  for (const f of ['document.json', 'graph.json', 'work-state.json']) {
    const s = join(src, f)
    if (existsSync(s)) cpSync(s, join(dst, f))
  }
  const up = join(src, 'uploads')
  if (existsSync(up)) cpSync(up, join(dst, 'uploads'), { recursive: true })
}
