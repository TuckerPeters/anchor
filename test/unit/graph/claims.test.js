// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe } from 'vitest'
import { parseCrossRefLabel, matchSourceForFootnote } from '../../../src/main/graph/claims.js'

describe('parseCrossRefLabel', () => {
  it('extracts a "Section X.Y" label from a "Section" reference', () => {
    expect(parseCrossRefLabel('See infra Section III.B.')).toBe('Section III.B')
  })

  it('extracts a "Section X.Y" label from a "§" reference', () => {
    expect(parseCrossRefLabel('See § 4.2 above for the full methodology.')).toBe('Section 4.2')
  })

  it('falls back to a "Note N" label for a bare supra/infra note reference', () => {
    expect(parseCrossRefLabel('NREL, supra note 1, at 14.')).toBe('Note 1')
  })

  it('returns null when no cross-reference shape is present', () => {
    expect(parseCrossRefLabel('NREL, Lithium-Ion Battery Degradation Under Fast Charging (2021).')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseCrossRefLabel('')).toBeNull()
    expect(parseCrossRefLabel(undefined)).toBeNull()
  })
})

describe('matchSourceForFootnote', () => {
  const registerSources = [
    { key: 'NREL2021', class: 'paper', title: 'NREL, Lithium-Ion Battery Degradation Under Fast Charging (2021)' },
    { key: 'UL9540A', class: 'docs', title: 'UL 9540A Test Method for Thermal Runaway Fire Propagation' },
    { key: 'cellsim', class: 'repo', title: 'cellsim — open-source cell thermal simulator' }
  ]

  it('matches a footnote to the source with the highest token overlap', () => {
    const fn = { rawText: 'NREL, Lithium-Ion Battery Degradation Under Fast Charging 12 (2021).' }
    const match = matchSourceForFootnote(fn, registerSources)
    expect(match?.key).toBe('NREL2021')
  })

  it('matches on key tokens split across letter/digit boundaries', () => {
    const fn = { rawText: 'See UL 9540A Test Method, 4th ed.' }
    const match = matchSourceForFootnote(fn, registerSources)
    expect(match?.key).toBe('UL9540A')
  })

  it('returns null when no candidate has meaningful overlap', () => {
    const fn = { rawText: 'Internal test data, on file.' }
    expect(matchSourceForFootnote(fn, registerSources)).toBeNull()
  })

  it('returns null for empty registerSources or footnote', () => {
    expect(matchSourceForFootnote({ rawText: 'NREL 2021' }, [])).toBeNull()
    expect(matchSourceForFootnote({ rawText: '' }, registerSources)).toBeNull()
  })

  it('is deterministic (same inputs -> same output)', () => {
    const fn = { rawText: 'cellsim, commit ____ (simulation).' }
    const a = matchSourceForFootnote(fn, registerSources)
    const b = matchSourceForFootnote(fn, registerSources)
    expect(a).toBe(b)
  })
})
