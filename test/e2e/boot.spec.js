// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { test, expect, _electron as electron } from '@playwright/test'
import { buildMinimalPdf } from '../fixtures/makePdf.js'
import { buildDocxFixture, wrapDocumentXml, wrapFootnotesXml } from '../fixtures/makeDocx.js'

async function launch() {
  const app = await electron.launch({ args: ['.'] })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win }
}

test('boots to Documents and shows the seeded demo', async () => {
  const { app, win } = await launch()
  await expect(win.getByRole('heading', { name: /your reports/i })).toBeVisible()
  await expect(win.getByText(/sample report/i)).toBeVisible()
  await expect(win.getByText(/thermal runaway/i)).toBeVisible()
  await app.close()
})

test('opens the demo, resolves an item, and the queue count drops', async () => {
  const { app, win } = await launch()
  await win.locator('.doc.demo').first().click()
  // Review workspace
  await expect(win.locator('.q-head')).toContainText(/to resolve/i)
  const before = parseInt(await win.locator('.q-head .big').first().innerText(), 10)
  await win.getByRole('button', { name: /done & next/i }).click()
  // an undo toast confirms the write
  await expect(win.getByText(/marked "done"/i)).toBeVisible()
  const after = parseInt(await win.locator('.q-head .big').first().innerText(), 10)
  expect(after).toBe(before - 1)
  await app.close()
})

test('full pipeline through the app: create → import bytes → build → ready graph', async () => {
  const { app, win } = await launch()
  const CLAIM = 'Photovoltaic efficiency rises as cell temperature falls'
  const body = `<w:p w14:paraId="P1"><w:r><w:t xml:space="preserve">${CLAIM}</w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r></w:p>`
  const footnotes = wrapFootnotesXml(
    `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
    `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
    `<w:footnote w:id="2"><w:p><w:r><w:t>Green et al., Solar Cell Efficiency Tables 45 (2021).</w:t></w:r></w:p></w:footnote>`
  )
  const docxB64 = buildDocxFixture({ documentXml: wrapDocumentXml(body), footnotesXml: footnotes }).toString('base64')
  const pdfB64 = buildMinimalPdf([{ width: 320, height: 200, items: [{ text: CLAIM, x: 30, y: 150, size: 12 }] }]).toString('base64')

  const result = await win.evaluate(async ({ docxB64, pdfB64 }) => {
    const toBuf = (b) => { const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer }
    const doc = await window.anchor.documents.create({ title: 'Pipeline GUI' })
    await window.anchor.documents.saveFiles(doc.id, { docx: { name: 'r.docx', bytes: toBuf(docxB64) }, pdf: { name: 'r.pdf', bytes: toBuf(pdfB64) } })
    await window.anchor.documents.build(doc.id)
    for (let i = 0; i < 60; i++) {
      const d = await window.anchor.documents.get(doc.id)
      if (d.status === 'ready') { const g = await window.anchor.documents.getGraph(doc.id); return { status: 'ready', stats: d.stats, located: g.nodes.claims[0]?.anchor?.state } }
      if (d.status === 'failed') return { status: 'failed' }
      await new Promise((r) => setTimeout(r, 150))
    }
    return { status: 'timeout' }
  }, { docxB64, pdfB64 })

  expect(result.status).toBe('ready')
  expect(result.stats.footnotes).toBe(1)
  expect(result.stats.claims).toBeGreaterThanOrEqual(1)
  expect(result.located).toBe('located')
  await app.close()
})

test('walks every page on the demo (confidence states, Map, Handoff, Setup)', async () => {
  const { app, win } = await launch()
  await win.locator('.doc.demo').first().click()
  await expect(win.locator('.q-head')).toContainText(/to resolve/i)
  await expect(win.locator('.banner')).toContainText(/located/i)                 // located state
  await win.locator('.row', { hasText: 'Bench testing' }).click()
  await expect(win.locator('.banner')).toContainText(/couldn.t pinpoint/i)       // none state
  await win.locator('.row', { hasText: 'Federal rulemaking' }).click()
  await expect(win.locator('.banner')).toContainText(/approximate/i)             // approximate state
  await win.getByRole('button', { name: /^map$/i }).click()                       // Map
  await expect(win.locator('.node').first()).toBeVisible()
  await win.getByRole('button', { name: /^handoff$/i }).click()                   // Handoff
  await expect(win.getByText(/next reviewer needs to decide/i)).toBeVisible()
  await win.locator('.ai').click()                                                // Setup via AI chip
  await expect(win.getByText(/works fully without ai/i)).toBeVisible()
  await app.close()
})

test('creates a new document', async () => {
  const { app, win } = await launch()
  await win.getByRole('button', { name: /new report/i }).first().click()
  await win.getByPlaceholder(/andersen/i).fill('E2E Report')
  await win.getByRole('button', { name: /^create$/i }).click()
  // lands on Import for the new document
  await expect(win.getByRole('heading', { name: /add your documents/i })).toBeVisible()
  await app.close()
})
