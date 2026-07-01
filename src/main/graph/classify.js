// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Deterministic footnote classification. classifyFootnote() is pure regex heuristics —
// no AI, no network — so it always runs and is always the source of truth; an optional
// AI pass (Phase 4) may later attach an `ai.class` *suggestion* alongside it, but never
// replaces this value.
//
// Branches are checked in priority order (first match wins) because a single footnote's
// rawText can plausibly trip more than one pattern (e.g. a docket citation containing the
// filler "___" also matches the "missing" keyword list). The order below is chosen so the
// most specific / highest-value signal wins:
//   1. explicit "unidentified source" markers -> missing (nothing else matters if the
//      source itself is unknown)
//   2. link-shaped text -> repo (github) / web (any other URL)
//   3. legal citation shape -> case
//   4. internal cross-reference shape -> cross-reference
//   5. figure/exhibit shape -> screenshot
//   6. standards/docs shape -> docs
//   7. dated, prose-shaped citation -> paper
//   8. very short, non-citation text -> note
//   9. default -> paper (the common case for expert-report footnotes)

const MISSING_RE = /on file|internal|unknown|___|TBD/i
const GITHUB_RE = /github\.com/i
const URL_RE = /https?:\/\//i
const CASE_RE = /docket|no\.\s|v\.\s|f\.\s?supp|u\.s\.c|c\.f\.r|rulemaking/i
const CROSSREF_RE = /supra|infra|see (above|below)|§|section [ivx0-9]/i
const SCREENSHOT_RE = /screenshot|figure|fig\.|exhibit/i
const DOCS_RE = /manual|documentation|spec|standard|ul \d|iso \d|ieee/i
const YEAR_RE = /\b(19|20)\d\d\b/

const CITATION_NEED = {
  paper: 'Verify version and exact page.',
  docs: 'Confirm the edition and year.',
  case: 'Add the full docket number and date.',
  repo: 'Pin the exact commit hash.',
  web: 'Confirm the URL and access date.',
  screenshot: 'Confirm the figure/exhibit reference.',
  'cross-reference': 'Confirm the internal target section.',
  missing: 'Identify the source.',
  note: ''
}

/** A dated citation reads as "academic" once it has more than a bare year in it. */
function looksAcademic(text) {
  return /,/.test(text) || /\bat\s+\d/i.test(text) || text.trim().split(/\s+/).length >= 5
}

/** Short strings with none of the citation signals above are just editorial notes. */
function looksLikeShortNote(trimmed) {
  if (!trimmed) return false
  const words = trimmed.split(/\s+/)
  return words.length <= 4 && trimmed.length <= 24
}

/**
 * @param {string} rawText
 * @returns {{class: import('../../../shared/types.js').SourceClass, citationNeed: string}}
 */
export function classifyFootnote(rawText) {
  const text = String(rawText ?? '')
  const trimmed = text.trim()

  let cls
  if (trimmed === '' || MISSING_RE.test(text)) {
    cls = 'missing'
  } else if (GITHUB_RE.test(text)) {
    cls = 'repo'
  } else if (URL_RE.test(text)) {
    cls = 'web'
  } else if (CASE_RE.test(text)) {
    cls = 'case'
  } else if (CROSSREF_RE.test(text)) {
    cls = 'cross-reference'
  } else if (SCREENSHOT_RE.test(text)) {
    cls = 'screenshot'
  } else if (DOCS_RE.test(text)) {
    cls = 'docs'
  } else if (YEAR_RE.test(text) && looksAcademic(text)) {
    cls = 'paper'
  } else if (looksLikeShortNote(trimmed)) {
    cls = 'note'
  } else {
    cls = 'paper'
  }

  return { class: cls, citationNeed: CITATION_NEED[cls] }
}
