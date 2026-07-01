// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Synthetic PDF builder for tests. Hand-writes a minimal, valid, classic-xref PDF
// (Helvetica core font, Tj text-showing operators) — no dependency on a real-world
// fixture file. pdf.js parses this reliably in its legacy/Node build.

function escapePdfText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

/**
 * @param {Array<{width?:number, height?:number, items?:Array<{text:string,x:number,y:number,size?:number}>}>} pages
 * @returns {Buffer}
 */
export function buildMinimalPdf(pages) {
  if (!pages || pages.length === 0) pages = [{ items: [] }]

  const fontNum = 1
  const pagesNum = 2
  const catalogNum = 3
  const perPage = pages.map((_, i) => ({ pageNum: 4 + i * 2, contentNum: 5 + i * 2 }))

  const objects = {}
  objects[fontNum] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  const kids = perPage.map((p) => `${p.pageNum} 0 R`).join(' ')
  objects[pagesNum] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`
  objects[catalogNum] = `<< /Type /Catalog /Pages ${pagesNum} 0 R >>`

  pages.forEach((pg, i) => {
    const { pageNum, contentNum } = perPage[i]
    const w = pg.width ?? 200
    const h = pg.height ?? 200
    objects[pageNum] =
      `<< /Type /Page /Parent ${pagesNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> ` +
      `/MediaBox [0 0 ${w} ${h}] /Contents ${contentNum} 0 R >>`
    const lines = (pg.items || []).map((it) => {
      const size = it.size ?? 12
      return `BT /F1 ${size} Tf ${it.x} ${it.y} Td (${escapePdfText(it.text)}) Tj ET`
    })
    const content = lines.join('\n')
    objects[contentNum] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  })

  const maxNum = Math.max(...Object.keys(objects).map(Number))
  let out = '%PDF-1.4\n'
  const offsets = new Array(maxNum + 1).fill(0)
  for (let n = 1; n <= maxNum; n++) {
    offsets[n] = out.length
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`
  }
  const xrefStart = out.length
  out += `xref\n0 ${maxNum + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= maxNum; n++) out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${maxNum + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`
  return Buffer.from(out, 'latin1')
}
