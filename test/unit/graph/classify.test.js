// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe } from 'vitest'
import { classifyFootnote } from '../../../src/main/graph/classify.js'

describe('classifyFootnote', () => {
  it('classifies a github URL as repo', () => {
    const r = classifyFootnote('cellsim, https://github.com/example/cellsim, commit abc123.')
    expect(r).toEqual({ class: 'repo', citationNeed: 'Pin the exact commit hash.' })
  })

  it('classifies a generic URL as web', () => {
    const r = classifyFootnote('NREL fact sheet, https://www.nrel.gov/report.')
    expect(r).toEqual({ class: 'web', citationNeed: 'Confirm the URL and access date.' })
  })

  it('classifies a legal docket citation as case', () => {
    const r = classifyFootnote('See Smith v. Jones, No. 12-345, Docket 99 (2020).')
    expect(r).toEqual({ class: 'case', citationNeed: 'Add the full docket number and date.' })
  })

  it('classifies an internal cross-reference as cross-reference', () => {
    const r = classifyFootnote('See infra Section III.B.')
    expect(r).toEqual({ class: 'cross-reference', citationNeed: 'Confirm the internal target section.' })
  })

  it('classifies a figure/exhibit reference as screenshot', () => {
    const r = classifyFootnote('See Figure 3 below (screenshot of dashboard).')
    expect(r).toEqual({ class: 'screenshot', citationNeed: 'Confirm the figure/exhibit reference.' })
  })

  it('classifies a standards document as docs', () => {
    const r = classifyFootnote('UL 9540A Test Method for Thermal Runaway Fire Propagation (4th ed.).')
    expect(r).toEqual({ class: 'docs', citationNeed: 'Confirm the edition and year.' })
  })

  it('classifies a dated academic citation as paper', () => {
    const r = classifyFootnote('Smith, J., A Study of Things, 45 J. Applied Physics 100 (2019).')
    expect(r).toEqual({ class: 'paper', citationNeed: 'Verify version and exact page.' })
  })

  it('classifies empty/whitespace text as missing', () => {
    expect(classifyFootnote('')).toEqual({ class: 'missing', citationNeed: 'Identify the source.' })
    expect(classifyFootnote('   ')).toEqual({ class: 'missing', citationNeed: 'Identify the source.' })
  })

  it('classifies unidentified-source markers as missing', () => {
    expect(classifyFootnote('Internal test data, on file.')).toEqual({ class: 'missing', citationNeed: 'Identify the source.' })
    expect(classifyFootnote('Source unknown, TBD.')).toEqual({ class: 'missing', citationNeed: 'Identify the source.' })
  })

  it('classifies a very short non-citation string as note', () => {
    expect(classifyFootnote('Id.')).toEqual({ class: 'note', citationNeed: '' })
  })

  it('defaults undated non-conforming prose to paper', () => {
    const r = classifyFootnote('Personal communication with the laboratory director regarding measurement calibration procedures used throughout testing.')
    expect(r).toEqual({ class: 'paper', citationNeed: 'Verify version and exact page.' })
  })

  it('is a pure function of rawText (same input -> same output)', () => {
    const text = 'NREL, Lithium-Ion Battery Degradation Under Fast Charging 12 (2021).'
    expect(classifyFootnote(text)).toEqual(classifyFootnote(text))
  })
})
