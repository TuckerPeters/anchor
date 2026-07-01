// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Browser-side PDF text extraction (pdf.js in its native habitat). Produces PageData in the
// same shape as the desktop extractor, so buildGraph/anchorClaims work unchanged.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

function itemToBox(item) {
  const t = item.transform || [1, 0, 0, 1, 0, 0]
  return { x: t[4], y: t[5], w: item.width || 0, h: item.height || Math.hypot(t[2], t[3]) || 0 }
}

/** @param {Uint8Array|ArrayBuffer} bytes @returns {Promise<{pages:Array, textLayer:boolean}>} */
export async function extractPdfFromBytes(bytes) {
  const data = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes)
  const doc = await pdfjs.getDocument({ data }).promise
  const pages = []
  let total = 0
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()
    const items = tc.items.filter((it) => it && it.str != null).map((it) => ({ str: it.str, ...itemToBox(it) }))
    const text = items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()
    total += text.length
    pages.push({ number: n, width: vp.width, height: vp.height, items, text })
  }
  return { pages, textLayer: total > 40 }
}
