// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync, strToU8 } from 'fflate'
import { extractDocx } from '../../../src/main/extract/docx.js'
import { buildDocxFixture, wrapDocumentXml, wrapFootnotesXml } from '../../fixtures/makeDocx.js'

// Paragraphs written compactly (no inter-element whitespace) so we don't have to
// reason about stray formatting text bleeding into the extracted paragraph text —
// this also matches how Word actually serializes document.xml.
const P0 = '<w:p w14:paraId="00000001"><w:r><w:t xml:space="preserve">This is claim one with a citation.</w:t></w:r><w:r><w:footnoteReference w:id="5"/></w:r></w:p>'
const P1 = '<w:p><w:r><w:t xml:space="preserve">Second claim referencing note two.</w:t></w:r><w:r><w:footnoteReference w:id="2"/></w:r>' +
  '<w:ins w:id="100" w:author="A"><w:r><w:t xml:space="preserve"> Inserted clause.</w:t></w:r></w:ins>' +
  '<w:del w:id="101" w:author="A"><w:r><w:delText xml:space="preserve"> Deleted clause should not appear.</w:delText></w:r></w:del></w:p>'
const P2 = '<w:p w14:paraId="00000003"><w:r><w:t xml:space="preserve">Third claim with a </w:t></w:r>' +
  '<w:hyperlink r:id="rId5"><w:r><w:t xml:space="preserve">hyperlinked phrase</w:t></w:r></w:hyperlink>' +
  '<w:r><w:t xml:space="preserve"> and a repeat cite.</w:t></w:r>' +
  '<w:r><w:footnoteReference w:id="5"/></w:r><w:r><w:footnoteReference w:id="9"/></w:r></w:p>'
const P3 = '<w:p w14:paraId="00000004"><w:r><w:t xml:space="preserve">Page number field: </w:t></w:r>' +
  '<w:fldSimple w:instr=" PAGE "><w:r><w:t>3</w:t></w:r></w:fldSimple></w:p>'

const SEP = '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>'
const CONT = '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'
// Deliberately scrambled relative to reference order, to prove output is sorted by
// display number rather than by footnotes.xml source order.
const F9 = '<w:footnote w:id="9"><w:p><w:r><w:t xml:space="preserve">Not applicable.</w:t></w:r></w:p></w:footnote>'
const F2 = '<w:footnote w:id="2"><w:p><w:r><w:t xml:space="preserve">See supra note 5.</w:t></w:r></w:p></w:footnote>'
const F7 = '<w:footnote w:id="7"><w:p><w:r><w:t xml:space="preserve">Unused citation footnote text that is fairly long and never referenced.</w:t></w:r></w:p></w:footnote>'
const F5 = '<w:footnote w:id="5"><w:p><w:r><w:t xml:space="preserve">Smith Aff. </w:t></w:r><w:r><w:t xml:space="preserve">¶ 12 (2024).</w:t></w:r></w:p></w:footnote>'

function buildMainFixture() {
  const documentXml = wrapDocumentXml(P0 + P1 + P2 + P3)
  const footnotesXml = wrapFootnotesXml(SEP + CONT + F9 + F2 + F7 + F5)
  return buildDocxFixture({ documentXml, footnotesXml })
}

describe('extractDocx', () => {
  let dir
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'anchor-docx-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('throws a clear error when the file does not exist', async () => {
    await expect(extractDocx(join(dir, 'nope.docx'))).rejects.toThrow(/Could not read DOCX/)
  })

  it('throws a clear error when the zip has no word/document.xml', async () => {
    const badZip = Buffer.from(zipSync({ '[Content_Types].xml': strToU8('<Types/>') }))
    const path = join(dir, 'bad.docx')
    writeFileSync(path, badZip)
    await expect(extractDocx(path)).rejects.toThrow(/no word\/document\.xml/)
  })

  it('filters out separator and continuationSeparator footnotes', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { footnotes } = await extractDocx(path)
    expect(footnotes.map((f) => f.wid)).not.toContain('-1')
    expect(footnotes.map((f) => f.wid)).not.toContain('0')
    expect(footnotes).toHaveLength(4)
  })

  it('numbers footnotes by first-reference order in the body, not by w:id, and sorts output by number', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { footnotes } = await extractDocx(path)
    // wid 5 is referenced first (paragraph 0), wid 2 second (paragraph 1), wid 9 third
    // (paragraph 2, first new ref there — the repeat of wid 5 doesn't consume a slot).
    // wid 7 is never referenced, so it lands after all referenced footnotes.
    expect(footnotes.map((f) => [f.wid, f.number])).toEqual([
      ['5', 1], ['2', 2], ['9', 3], ['7', 4]
    ])
    expect(footnotes.map((f) => f.number)).toEqual([1, 2, 3, 4]) // sorted ascending
  })

  it('rewrites paragraph footnoteRefs from wid to display number, deduping repeat references to the same slot', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { paragraphs } = await extractDocx(path)
    expect(paragraphs[0].footnoteRefs).toEqual([1])
    expect(paragraphs[1].footnoteRefs).toEqual([2])
    expect(paragraphs[2].footnoteRefs).toEqual([1, 3]) // repeat cite to wid 5 -> number 1 again
    expect(paragraphs[3].footnoteRefs).toEqual([])
  })

  it('uses w14:paraId when present and falls back to pidx<index> when absent', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { paragraphs } = await extractDocx(path)
    expect(paragraphs[0].paraId).toBe('00000001')
    expect(paragraphs[1].paraId).toBe('pidx1') // no w14:paraId attribute on P1
    expect(paragraphs[1].index).toBe(1)
    expect(paragraphs[2].paraId).toBe('00000003')
  })

  it('extracts paragraph text including hyperlink-wrapped runs and field runs, excluding delText but including ins text', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { paragraphs } = await extractDocx(path)
    expect(paragraphs[0].text).toBe('This is claim one with a citation.')
    expect(paragraphs[1].text).toBe('Second claim referencing note two. Inserted clause.')
    expect(paragraphs[1].text).not.toContain('Deleted clause')
    expect(paragraphs[2].text).toBe('Third claim with a hyperlinked phrase and a repeat cite.')
    expect(paragraphs[3].text).toBe('Page number field: 3')
  })

  it('classifies footnote roles: cross-reference, note, and support', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { footnotes } = await extractDocx(path)
    const byWid = Object.fromEntries(footnotes.map((f) => [f.wid, f]))
    expect(byWid['2'].role).toBe('cross-reference') // "See supra note 5."
    expect(byWid['9'].role).toBe('note') // short, no citation-ish tokens
    expect(byWid['5'].role).toBe('support') // has pinpoint cite tokens (digits)
  })

  it('warns on tracked-changes when w:ins/w:del are present, without a false endnotes-found warning', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { warnings } = await extractDocx(path)
    expect(warnings).toContain('tracked-changes')
    expect(warnings).not.toContain('endnotes-found')
  })

  it('warns on endnotes-found when word/endnotes.xml is present', async () => {
    const documentXml = wrapDocumentXml('<w:p w14:paraId="1"><w:r><w:t xml:space="preserve">No footnotes here.</w:t></w:r></w:p>')
    const endnotesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:endnotes>'
    const path = join(dir, 'endnotes.docx')
    writeFileSync(path, buildDocxFixture({ documentXml, endnotesXml }))
    const { warnings, footnotes, paragraphs } = await extractDocx(path)
    expect(warnings).toContain('endnotes-found')
    expect(warnings).not.toContain('tracked-changes')
    expect(footnotes).toEqual([])
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].text).toBe('No footnotes here.')
  })

  it('returns all paragraphs, including ones without footnoteRefs', async () => {
    const path = join(dir, 'main.docx')
    writeFileSync(path, buildMainFixture())
    const { paragraphs } = await extractDocx(path)
    expect(paragraphs).toHaveLength(4)
    expect(paragraphs.map((p) => p.index)).toEqual([0, 1, 2, 3])
  })
})
