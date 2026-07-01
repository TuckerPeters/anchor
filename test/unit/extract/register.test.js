// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseRegisterText, parseRegister } from '../../../src/main/extract/register.js'

const SAMPLE_MD = `# Source Register

Some intro prose that should be ignored since it has no pipes.

| Key | Class | Title | URL | Local Candidate | Audit Note | Citation Need | Extra |
|-----|-------|-------|-----|------------------|------------|----------------|-------|
| smith-aff | paper | Smith Affidavit | https://example.com/smith, https://example.com/smith2 | ./docs/smith.pdf | Verified against original | none | ignored-extra-col |
| doe-report | docs | Doe Report | https://example.com/doe https://example.com/doe-mirror |  |  | pending |  |
| bare-key |  |  |  |  |  |  |  |

More trailing prose.
`

describe('parseRegisterText', () => {
  it('maps columns by header name and returns one SourceRaw per data row', () => {
    const { sources } = parseRegisterText(SAMPLE_MD)
    expect(sources).toHaveLength(3)
    expect(sources[0]).toEqual({
      key: 'smith-aff',
      class: 'paper',
      title: 'Smith Affidavit',
      url: ['https://example.com/smith', 'https://example.com/smith2'],
      localCandidate: './docs/smith.pdf',
      auditNote: 'Verified against original',
      citationNeed: 'none'
    })
  })

  it('splits the url cell on whitespace as well as commas', () => {
    const { sources } = parseRegisterText(SAMPLE_MD)
    expect(sources[1].url).toEqual(['https://example.com/doe', 'https://example.com/doe-mirror'])
  })

  it('skips the header separator row', () => {
    const { sources } = parseRegisterText(SAMPLE_MD)
    expect(sources.some((s) => /^:?-+:?$/.test(s.key))).toBe(false)
  })

  it('ignores extra/unrecognized columns without erroring', () => {
    const { sources } = parseRegisterText(SAMPLE_MD)
    expect(Object.keys(sources[0])).toEqual(['key', 'class', 'title', 'url', 'localCandidate', 'auditNote', 'citationNeed'])
  })

  it('defaults missing columns to empty string/array, and class to "note" when absent', () => {
    const { sources } = parseRegisterText(SAMPLE_MD)
    const bare = sources[2]
    expect(bare.key).toBe('bare-key')
    expect(bare.class).toBe('note')
    expect(bare.title).toBe('')
    expect(bare.url).toEqual([])
    expect(bare.localCandidate).toBe('')
    expect(bare.auditNote).toBe('')
    expect(bare.citationNeed).toBe('')
  })

  it('is tolerant of alternate header names (id/type/source/link/file/note/need)', () => {
    const md = [
      '| id | type | source | link | file | note | need |',
      '|---|---|---|---|---|---|---|',
      '| roe-dep | case | Roe Deposition | https://example.com/roe | ./roe.pdf | flagged for follow-up | urgent |'
    ].join('\n')
    const { sources } = parseRegisterText(md)
    expect(sources).toEqual([{
      key: 'roe-dep',
      class: 'case',
      title: 'Roe Deposition',
      url: ['https://example.com/roe'],
      localCandidate: './roe.pdf',
      auditNote: 'flagged for follow-up',
      citationNeed: 'urgent'
    }])
  })

  it('returns no sources for text with no table', () => {
    expect(parseRegisterText('Just a paragraph of prose, no table here.')).toEqual({ sources: [] })
  })

  it('returns no sources for empty input', () => {
    expect(parseRegisterText('')).toEqual({ sources: [] })
  })
})

describe('parseRegister (file path)', () => {
  let dir
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'anchor-register-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('reads the file and parses it the same as parseRegisterText', async () => {
    const path = join(dir, 'register.md')
    writeFileSync(path, SAMPLE_MD, 'utf8')
    const fromPath = await parseRegister(path)
    const fromText = parseRegisterText(SAMPLE_MD)
    expect(fromPath).toEqual(fromText)
  })

  it('throws a clear error when the file does not exist', async () => {
    await expect(parseRegister(join(dir, 'missing.md'))).rejects.toThrow(/Could not read register/)
  })
})
