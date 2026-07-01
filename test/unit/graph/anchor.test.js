// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { it, expect, describe } from 'vitest'
import { anchorClaims, pdfBoxToNormTopLeft, normalizeText } from '../../../src/main/graph/anchor.js'

const LIGATURE_FI = 'ﬁ' // LATIN SMALL LIGATURE FI, NFKC-normalizes to "fi"

function makeGraph(claims, pages) {
  return {
    nodes: {
      pages: pages.map((p) => ({ id: `p${p.number}`, number: p.number, width: p.width, height: p.height, text: p.text })),
      claims
    }
  }
}

function claim(id, text) {
  return { id, paraId: id, pageId: null, text, footnoteRefs: [], sourceIds: [], anchor: { state: 'none', score: 0 } }
}

describe('pdfBoxToNormTopLeft', () => {
  it('flips pdf.js bottom-left y-up coords into normalized top-left 0-1 coords', () => {
    // A box near the top of a 600x800 page in pdf.js space (y measured up from the bottom)
    // should land near y=0 (top) once flipped.
    const box = pdfBoxToNormTopLeft({ x: 100, y: 700, w: 200, h: 20 }, 600, 800)
    expect(box.x).toBeCloseTo(100 / 600, 10)
    expect(box.w).toBeCloseTo(200 / 600, 10)
    expect(box.h).toBeCloseTo(20 / 800, 10)
    // y=700,h=20 -> top edge at 720pt from the bottom -> 80pt from the top of an 800pt page
    expect(box.y).toBeCloseTo(80 / 800, 10)
  })

  it('maps a box flush with the bottom of the page to y near 1 (bottom, in top-left space)', () => {
    const box = pdfBoxToNormTopLeft({ x: 0, y: 0, w: 100, h: 20 }, 600, 800)
    expect(box.y).toBeCloseTo(1 - 20 / 800, 10)
  })

  it('maps a box flush with the top of the page to y = 0', () => {
    const box = pdfBoxToNormTopLeft({ x: 0, y: 780, w: 100, h: 20 }, 600, 800)
    expect(box.y).toBeCloseTo(0, 10)
  })

  it('clamps output to [0,1] even for out-of-bounds boxes', () => {
    const box = pdfBoxToNormTopLeft({ x: -50, y: -50, w: 5000, h: 5000 }, 600, 800)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(1)
    expect(box.y + box.h).toBeLessThanOrEqual(1)
  })
})

describe('normalizeText', () => {
  it('joins a hyphenated line break', () => {
    expect(normalizeText('propagation test-\ning is required')).toBe('propagation testing is required')
  })

  it('strips soft hyphens and collapses whitespace', () => {
    expect(normalizeText('prop­agation   testing\n\nis  required')).toBe('propagation testing is required')
  })

  it('NFKC-normalizes ligatures and lowercases', () => {
    expect(normalizeText(`The Battery Caught ${LIGATURE_FI}re`)).toBe('the battery caught fire')
  })
})

describe('anchorClaims', () => {
  const page1 = {
    number: 1, width: 600, height: 800,
    items: [{ str: 'Introduction to the report overview and executive summary.', x: 80, y: 700, w: 400, h: 18 }],
    text: 'Introduction to the report overview and executive summary.'
  }
  const page2 = {
    number: 2, width: 600, height: 800,
    items: [
      { str: 'The reactor exceeded safe temperature', x: 80, y: 700, w: 350, h: 18 },
      { str: 'thresholds during testing.', x: 80, y: 675, w: 200, h: 18 }
    ],
    text: 'The reactor exceeded safe temperature thresholds during testing.'
  }

  it('locates a claim on the correct page and unions its matched items into a bbox', () => {
    const c = claim('c-main', 'The reactor exceeded safe temperature thresholds during testing.')
    const graph = makeGraph([c], [page1, page2])

    anchorClaims(graph, [page1, page2])

    expect(c.pageId).toBe('p2')
    expect(c.anchor.state).toBe('located')
    expect(c.anchor.score).toBe(1)
    expect(c.anchor.bbox).toBeTruthy()
    for (const key of ['x', 'y', 'w', 'h']) {
      expect(c.anchor.bbox[key]).toBeGreaterThanOrEqual(0)
      expect(c.anchor.bbox[key]).toBeLessThanOrEqual(1)
    }
    // matched items sit near the top of the page (pdf.js y=700/675 on an 800pt page)
    expect(c.anchor.bbox.y).toBeLessThan(0.2)
    // union should span both matched items horizontally at least as wide as the first item
    expect(c.anchor.bbox.w).toBeGreaterThan(0.3)
  })

  it('joins a hyphenated line break across pages so the claim still locates exactly', () => {
    const page3 = {
      number: 3, width: 600, height: 800, items: [],
      text: 'Standardized propagation test-\ning is required before certification.'
    }
    const c = claim('c-hyphen', 'Standardized propagation testing is required before certification.')
    const graph = makeGraph([c], [page1, page2, page3])

    anchorClaims(graph, [page1, page2, page3])

    expect(c.pageId).toBe('p3')
    expect(c.anchor.state).toBe('located')
    expect(c.anchor.score).toBe(1)
    // no items on this page -> falls back to a coarse full-line box, still valid
    expect(c.anchor.bbox).toEqual({ x: 0.1, y: 0, w: 0.8, h: 0.05 })
  })

  it('matches case-insensitively regardless of source casing', () => {
    const page4 = {
      number: 4, width: 600, height: 800,
      items: [{ str: 'THE REACTOR OPERATED WITHIN NOMINAL PARAMETERS.', x: 80, y: 700, w: 400, h: 18 }],
      text: 'THE REACTOR OPERATED WITHIN NOMINAL PARAMETERS.'
    }
    const c = claim('c-case', 'the reactor operated within nominal parameters.')
    const graph = makeGraph([c], [page4])

    anchorClaims(graph, [page4])

    expect(c.pageId).toBe('p4')
    expect(c.anchor.state).toBe('located')
    expect(c.anchor.score).toBe(1)
  })

  it('NFKC-normalizes a ligature so the claim still locates exactly', () => {
    const page5 = {
      number: 5, width: 600, height: 800,
      items: [{ str: `The battery caught ${LIGATURE_FI}re during testing.`, x: 80, y: 700, w: 300, h: 18 }],
      text: `The battery caught ${LIGATURE_FI}re during testing.`
    }
    const c = claim('c-ligature', 'The battery caught fire during testing.')
    const graph = makeGraph([c], [page5])

    anchorClaims(graph, [page5])

    expect(c.pageId).toBe('p5')
    expect(c.anchor.state).toBe('located')
    expect(c.anchor.score).toBe(1)
  })

  it('degrades unmatched claims to state "none" with no pageId and no bbox', () => {
    const c = claim('c-nomatch', 'Quantum entanglement violates locality assumptions in this unrelated experiment about photons.')
    const graph = makeGraph([c], [page1, page2])

    anchorClaims(graph, [page1, page2])

    expect(c.pageId).toBeNull()
    expect(c.anchor).toEqual({ state: 'none', score: 0 })
    expect(c.anchor.bbox).toBeUndefined()
  })

  it('degrades an empty claim text to state "none" without throwing', () => {
    const c = claim('c-empty', '   ')
    const graph = makeGraph([c], [page1, page2])
    expect(() => anchorClaims(graph, [page1, page2])).not.toThrow()
    expect(c.pageId).toBeNull()
    expect(c.anchor).toEqual({ state: 'none', score: 0 })
  })
})
