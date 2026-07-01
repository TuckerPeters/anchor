// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Render a PDF page to a canvas in the renderer (pdf.js in its native browser habitat —
// no native canvas dependency). Used by PdfPage when a real PDF asset is available.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const docCache = new Map()

export async function loadPdf(url) {
  if (!url) return null
  if (docCache.has(url)) return docCache.get(url)
  const doc = await pdfjs.getDocument({ url }).promise
  docCache.set(url, doc)
  return doc
}

export async function renderPage(doc, pageNumber, canvas, targetWidth) {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = targetWidth / base.width
  const vp = page.getViewport({ scale })
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(vp.width * dpr)
  canvas.height = Math.round(vp.height * dpr)
  canvas.style.width = vp.width + 'px'
  canvas.style.height = vp.height + 'px'
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  return { width: vp.width, height: vp.height }
}
