// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { itemToBox, extractPdf } from '../../../src/main/extract/pdf.js'
import { buildMinimalPdf } from '../../fixtures/makePdf.js'

describe('itemToBox (pure transform math, no PDF needed)', () => {
  it('reads x,y from the translation components of the text matrix', () => {
    const box = itemToBox({ transform: [12, 0, 0, 12, 20, 150], width: 62, height: 12 })
    expect(box.x).toBe(20)
    expect(box.y).toBe(150)
  })

  it('uses item.width and item.height when present', () => {
    const box = itemToBox({ transform: [10, 0, 0, 10, 0, 0], width: 55.5, height: 10 })
    expect(box.w).toBe(55.5)
    expect(box.h).toBe(10)
  })

  it('falls back to the matrix vertical scale (font size) when height is missing', () => {
    const box = itemToBox({ transform: [14, 0, 0, 14, 5, 5], width: 40 })
    expect(box.h).toBe(14)
  })

  it('falls back to the matrix vertical scale when height is exactly 0', () => {
    const box = itemToBox({ transform: [9, 0, 0, 9, 0, 0], width: 0, height: 0 })
    expect(box.h).toBe(9)
  })

  it('defaults to an identity-ish box for a malformed/missing transform', () => {
    const box = itemToBox({ width: 0, height: 0 })
    expect(box.x).toBe(0)
    expect(box.y).toBe(0)
    expect(box.h).toBe(1) // hypot(0,1) from the identity fallback matrix
  })
})

describe('extractPdf', () => {
  let dir
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'anchor-pdf-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('throws a clear error when the file does not exist', async () => {
    await expect(extractPdf(join(dir, 'nope.pdf'))).rejects.toThrow(/Could not read PDF/)
  })

  it('extracts a single page with one text item, preserving pdf.js native (bottom-left, y-up) coordinates', async () => {
    const buf = buildMinimalPdf([
      { width: 300, height: 400, items: [{ text: 'Hello World', x: 20, y: 350, size: 14 }] }
    ])
    const path = join(dir, 'one-page.pdf')
    writeFileSync(path, buf)

    const result = await extractPdf(path)
    expect(result.pages).toHaveLength(1)
    const page = result.pages[0]
    expect(page.number).toBe(1)
    expect(page.width).toBe(300)
    expect(page.height).toBe(400)
    expect(page.text).toContain('Hello World')
    expect(page.items.length).toBeGreaterThan(0)
    const item = page.items.find((it) => it.str === 'Hello World')
    expect(item).toBeTruthy()
    expect(item.x).toBe(20)
    expect(item.y).toBe(350) // native space: NOT flipped to top-left here
    expect(item.h).toBeGreaterThan(0)
  })

  it('extracts multiple pages independently, in order', async () => {
    const buf = buildMinimalPdf([
      { width: 300, height: 400, items: [{ text: 'Page one line A', x: 20, y: 350, size: 14 }, { text: 'Second line', x: 20, y: 320 }] },
      { width: 300, height: 400, items: [{ text: 'Page two only line', x: 20, y: 350 }] }
    ])
    const path = join(dir, 'two-pages.pdf')
    writeFileSync(path, buf)

    const result = await extractPdf(path)
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0].number).toBe(1)
    expect(result.pages[0].text).toContain('Page one line A')
    expect(result.pages[0].text).toContain('Second line')
    expect(result.pages[1].number).toBe(2)
    expect(result.pages[1].text).toContain('Page two only line')
    expect(result.textLayer).toBe(true)
  })

  it('marks textLayer:false for a page with no extractable text (simulated scan)', async () => {
    const buf = buildMinimalPdf([{ width: 200, height: 200, items: [] }])
    const path = join(dir, 'scanned.pdf')
    writeFileSync(path, buf)

    const result = await extractPdf(path)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0].text).toBe('')
    expect(result.textLayer).toBe(false)
  })

  it('normalizes runs of whitespace in page.text', async () => {
    const buf = buildMinimalPdf([
      { width: 300, height: 100, items: [{ text: 'A   B', x: 10, y: 50 }, { text: 'C', x: 10, y: 30 }] }
    ])
    const path = join(dir, 'ws.pdf')
    writeFileSync(path, buf)

    const result = await extractPdf(path)
    expect(result.pages[0].text).not.toMatch(/\s{2,}/)
  })
})
