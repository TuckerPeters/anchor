// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// anchor:// custom protocol — serves local document assets (the uploaded PDF / register)
// to the renderer, with a realpath check so a crafted URL can never escape the document dir.
import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'
import { realpathSync, existsSync } from 'node:fs'
import { join, sep } from 'node:path'
import { docDir, uploadsDir, docFile } from './store/paths.js'
import { readFileSync } from 'node:fs'

// Must run before app 'ready'.
export function registerAnchorScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'anchor', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

function resolveAsset(root, id, kind) {
  if (!/^[a-z0-9-]+$/i.test(id)) return null
  let doc
  try { doc = JSON.parse(readFileSync(docFile(root, id), 'utf8')) } catch { return null }
  const name = kind === 'pdf' ? doc.inputs?.pdf : kind === 'register' ? doc.inputs?.register : null
  if (!name) return null
  const candidate = join(uploadsDir(root, id), name)
  if (!existsSync(candidate)) return null
  try {
    const real = realpathSync(candidate)
    const base = realpathSync(docDir(root, id))
    if (real !== base && !real.startsWith(base + sep)) return null
    return real
  } catch { return null }
}

export function registerProtocol(root) {
  protocol.handle('anchor', async (req) => {
    try {
      const url = new URL(req.url) // anchor://doc/<id>/<kind>
      const parts = url.pathname.split('/').filter(Boolean)
      const id = parts[0]
      const kind = parts[1]
      if (url.host !== 'doc' || !id || !kind) return new Response('bad request', { status: 400 })
      const file = resolveAsset(root, id, kind)
      if (!file) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(file).href)
    } catch {
      return new Response('error', { status: 500 })
    }
  })
}
