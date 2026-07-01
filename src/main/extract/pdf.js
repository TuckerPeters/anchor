// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Deterministic PDF text-layer extraction. Runs pdf.js's LEGACY (no-canvas) build in
// Node: getTextContent() per page, no rendering. Coordinates are left in pdf.js's
// native space (origin bottom-left, y increases upward) — the graph anchorer (Phase 3)
// owns the conversion to normalized top-left display space, not this layer.
import { readFileSync } from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

// pdf.js text items don't reliably report a font-derived height when the PDF omits
// glyph metrics; fall back to the vertical scale of the item's text-rendering matrix
// (the [c, d] pair), which is effectively the font size for unrotated text.
function fallbackHeight(transform) {
  const t = transform || [1, 0, 0, 1, 0, 0]
  return Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]) || 0
}

/**
 * Pure transform math: pdf.js text item -> {x,y,w,h} box in pdf.js's native
 * coordinate space. `viewportHeight` is accepted (not applied) so callers/future
 * consumers have it on hand without changing this function's signature; this layer
 * intentionally does NOT flip to top-left/normalized space — see file header.
 * @param {{transform:number[], width?:number, height?:number}} item
 * @param {number} [viewportHeight]
 */
export function itemToBox(item, viewportHeight) {
  const t = (item && item.transform) || [1, 0, 0, 1, 0, 0]
  const x = t[4]
  const y = t[5]
  const w = typeof item?.width === 'number' ? item.width : 0
  const h = typeof item?.height === 'number' && item.height > 0 ? item.height : fallbackHeight(t)
  return { x, y, w, h }
}

/**
 * @param {string} pdfPath
 * @returns {Promise<{pages: Array<{number:number,width:number,height:number,items:Array<{str:string,x:number,y:number,w:number,h:number}>,text:string}>, textLayer:boolean}>}
 */
export async function extractPdf(pdfPath) {
  let buf
  try {
    buf = readFileSync(pdfPath)
  } catch (err) {
    throw new Error(`Could not read PDF at "${pdfPath}": ${err.message}`)
  }

  let doc
  try {
    // Fresh Uint8Array per load: pdf.js structured-clones/transfers the buffer into
    // its (fake, in-process) worker, which detaches it — reusing a buffer across
    // calls throws a DataCloneError on the second use.
    const data = new Uint8Array(buf)
    const loadingTask = pdfjs.getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      verbosity: 0
    })
    doc = await loadingTask.promise
  } catch (err) {
    throw new Error(`Could not parse PDF at "${pdfPath}": ${err.message}`)
  }

  const pages = []
  let totalTextLength = 0
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent()
      const items = content.items.map((item) => {
        const box = itemToBox(item, viewport.height)
        return { str: item.str, x: box.x, y: box.y, w: box.w, h: box.h }
      })
      const text = items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()
      totalTextLength += text.length
      pages.push({ number: i, width: viewport.width, height: viewport.height, items, text })
    }
  } finally {
    await doc.destroy()
  }

  return { pages, textLayer: totalTextLength > 40 }
}
