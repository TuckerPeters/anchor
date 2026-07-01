# Anchor — Design Spec

- **Author:** Tucker Peters (authored independently, in the author's personal time)
- **Date:** 2026-06-30
- **Status:** Approved (design) → planning
- **License:** Apache-2.0 + NOTICE asserting personal authorship

---

## 1. Overview & goals

**Anchor** is a local, private desktop workbench that makes citation uncertainty in an
expert report **visible, trackable, and reviewable**. It ingests a DOCX draft and the
rendered PDF (plus an optional Markdown source register), reconstructs the provenance chain

> **PDF page → claim/paragraph → footnote → source → possible internal cross-reference**

and then guides a **non-technical operator** through resolving every uncertain link before
handoff.

Anchor does **not** decide whether a citation is legally final. It surfaces what still needs
a human decision (missing source, weak pincite, unconfirmed cross-reference, reused source,
unverified support) and tracks that decision through to completion.

### Primary goals
1. **Works for people who have a Claude *or* ChatGPT subscription** — using the local CLI
   coding agents (Claude Code / Codex), which those subscriptions authenticate. No API key,
   no per-token cost.
2. **Non-technical, works directly in the app.** A never-coded-before user runs a one-time
   auto-installer, then does everything by double-clicking the app.
3. **Bulletproof.** The app is fully usable with zero AI (deterministic baseline); AI is an
   enhancer that can never crash or hang the workflow.
4. **Private.** 100% local. Confidential expert-report content never touches a server the
   author runs — there is no such server.
5. **Beautiful & clear.** How the work *looks* is paramount: a calm, guided review queue
   with real rendered PDF pages, not a raw graph to decode.
6. **Open source, unmistakably Tucker Peters' personal IP.**

## 2. Non-goals
- Not a legal citation generator or Bluebook/authority validator.
- Not a cloud/SaaS product; no accounts, no hosted backend, no telemetry.
- Not a general document editor or PDF annotator.
- Not a multi-user collaboration server (single-operator, file-based; handoff is by export).

## 3. Users & context
- **Operator:** a paralegal / analyst / expert-report reviewer. Comfortable with documents,
  **not** with code, terminals, or APIs.
- **Context:** confidential expert-report drafts; privacy is non-negotiable.
- **Platforms:** macOS (built + tested on this machine) and Windows (PowerShell installer
  written carefully, flagged as needing a Windows test before release). Linux best-effort.

## 4. Architecture

Single self-contained **Electron** desktop app (Svelte + Vite renderer, Node main process).

```
Anchor.app (Electron, double-click)
├─ Renderer  — Svelte + Vite UI: Documents · Import · Analyze · Review · Map · Handoff · Setup
├─ Main (Node) — local file store, job runner, IPC, process orchestration
│    ├─ Extractors (deterministic, all-JS, no Python required):
│    │    • PDF text + layout + positions   → pdf.js (getTextContent w/ transforms)
│    │    • PDF page rendering to PNG        → pdf.js (canvas) for the visual review
│    │    • DOCX footnotes + references      → unzip + parse word/footnotes.xml, document.xml
│    │    • Source register                  → Markdown table parser
│    └─ AI engine (subscription-authed, local):
│         detect + drive `claude -p --output-format json`  OR  `codex exec`
│         semantic passes over extracted text (see §5)
└─ Storage: plain JSON on disk under <userData>/Anchor/documents/<id>/
     graph.json · work-state.json · uploads/ · pages/*.png · jobs/*.json   (no database)
```

**Why Electron, not Tauri:** matches the Svelte+Node stack, keeps everything JavaScript,
and spawning child processes (`claude`, `codex`) is native to the Node main process. Electron
bundles Node + Chromium, so the *app* is self-contained; the only external tool the user
installs is the CLI agent (for AI features). Tauri is the smaller-binary alternative, not
chosen to avoid a Rust toolchain and to move faster.

**Why all-JS extraction (departure from the reference's Python + poppler):** `pdf.js` gives
per-item text with x/y transforms — better than `pdftotext -layout` for building highlight
overlays — *and* renders pages to images. DOCX is a zip of XML, parseable in JS. Dropping
Python + poppler removes two installed dependencies and simplifies packaging. (`pdftotext`
may be kept as an optional fallback extractor, but is not required.)

## 5. AI engine — bulletproof by design
- **Auto-detect** at launch: is `claude` present and signed in? is `codex` present and signed
  in? Use whichever exists; if both, user picks a default. A status chip shows
  `AI: Claude Code ✓` / `Codex ✓` / `Not connected — deterministic mode`.
- **Deterministic baseline runs first, always.** Heuristic extraction produces a complete
  graph with zero AI, so the app works with no CLI connected or if any AI pass fails. AI is
  an enhancer, never a hard dependency.
- **Semantic passes** (each optional, each improves specific fields):
  1. **Claim detection** — identify claim-like paragraphs that carry footnote refs.
  2. **Footnote classification** — class ∈ {paper, docs, repo, web, case, screenshot,
     cross-reference, missing, note}.
  3. **Citation-need generation** — plain-English "what to check" (e.g., "verify version and
     exact page", "add docket number", "confirm internal target", "identify source").
  4. **Cross-reference candidate detection** — likely internal targets for "see supra/infra".
- **Chunked, schema-constrained, validated:** each pass sends a bounded slice with a strict
  output contract, parses fenced JSON, validates against a JSON schema, and on a bad parse
  **re-prompts once** ("return ONLY valid JSON matching this shape"). On repeated failure it
  **degrades to the deterministic result** for that slice and logs it — never a crash/hang.
- **Resumable + limit-friendly:** passes checkpoint to disk; a rate-limit or quit resumes.
  A ~130-footnote report is a handful of calls, comfortably within Pro/Plus limits.
- **Invocation contract:** headless only — `claude -p "<prompt>" --output-format json`
  (parse the `result` field) or `codex exec "<prompt>"` (parse fenced JSON from stdout).
  Timeouts, cancellation, and stderr capture handled by the job runner.

## 6. Extraction & graph model

**Nodes:** `page`, `claim`, `footnote`, `source`, `target` (candidate internal cross-ref).

**Edges:** `page→claim`, `claim→footnote`, `claim→source`, `footnote→source`,
`footnote→target` (candidate), `source↔source` reuse is expressed via shared source nodes.

**Per-node fields (generated, read-only):**
- `source`: citationNeed, class, title, url(s), localCandidate, auditNote, linkedClaims.
- `footnote`: role, rawText, linkedSources, candidateTargets, claimsUsing.
- `claim`: page, paragraphId, footnotes, sources, fullText, bbox (for PDF highlight).
- `page`: number, imagePath, bodyZones, footnoteZones.

The deterministic builder ports the reference heuristics (source-register parsing, footnote
zone detection, claim/footnote-ref matching, class inference, citation-need templates) into
JS; AI passes overwrite/augment `class`, `citationNeed`, `candidateTargets`, and claim
boundaries when available.

## 7. Data model & storage
- No database. Per-document folder `<userData>/Anchor/documents/<id>/`:
  - `document.json` — metadata (title, status, inputs, counts, timestamps).
  - `graph.json` — generated, **read-only** product data.
  - `work-state.json` — mutable human review overlay.
  - `uploads/` — original DOCX/PDF/register.
  - `pages/` — rendered page PNGs.
  - `jobs/<jobId>.json` — build/analyze job logs + progress.
- Renderer mirrors work-state in memory; autosave writes to disk and merges by timestamp on
  load; flush on quit/visibility change. No data loss.

## 8. Review state & workflow
- `graph.json` is read-only; human progress is a separate overlay.
- Per reviewed node: `status ∈ {todo, triage, source-found, support-checked, drafted, done,
  blocked}`, `note` (freeform), `updatedAt`.
- **Cascade:** marking a page marks its claims + footnotes; marking a claim marks its
  footnotes; marking a source marks its linked footnotes (matches reference behavior).
- **Workflow:** create/pick document → drag DOCX + PDF (+ optional register) → extract &
  render → deterministic graph appears instantly → optional "Enhance with AI" → work the
  review queue to zero → export handoff.

## 9. UX — how it looks (top priority)

Reframe the primary surface from *"a graph you decode"* to *"a calm review queue you clear,"*
with the graph as a secondary map.

**Design language:** serious, trustworthy, quiet (Linear/Superhuman-grade polish for a
professional tool). Light + dark. A proper reading typeface for legal prose. Restrained
palette where **status colors carry meaning**. Full keyboard support (`j/k` prev/next, number
keys for status) *and* fully mouse-driven for non-coders. Accessible (WCAG AA, visible focus,
screen-reader labels, honors reduced-motion).

**Screens:**
1. **Documents** — clean cards with a progress ring ("68% reviewed · 12 blocked").
2. **Import** — friendly drop targets; post-extraction plain-English summary of what was
   found (pages, footnotes, sources, candidate cross-refs).
3. **Analyze** — honest progress with live extractor/AI status (no fake spinners).
4. **Review workspace (the heart):**
   - **Left:** filterable **queue** grouped by kind (missing source · needs pincite ·
     unconfirmed cross-ref · reused source · support unverified) + urgency; a count ticking
     to zero.
   - **Center:** focused item — claim text, footnote text, the **actual rendered PDF page
     with the exact spot highlighted**, source details, and a plain-English "**What's
     uncertain:** …". Inline actions: set status, add note, resolve, next.
   - **Right (toggle):** context — "this source also supports 4 other claims," linked
     footnotes, candidate internal targets.
5. **Map** — the relationship graph (page→claim→footnote→source→target), zoomable, for
   spatial overview and **source-reuse** analysis. Secondary, opened on demand.
6. **Handoff** — coverage dashboard + one-click export: a readable status/notes report for
   the next person *and* the raw `work-state.json`.

## 10. First-run setup / installer (never-coded-before path)
A **full auto-installer**, run once:
- **macOS** `install-anchor.command` (double-clickable): Homebrew if missing → Node → the
  chosen CLI agent (Claude Code or Codex) → guided sign-in → verify with a test call.
- **Windows** `install-anchor.ps1`: same via `winget`.
- The app's **first-run Setup Wizard** checks each dependency (green ✓ / red ✗) with a "Fix
  this" button per step, ending at "Sign in to your AI" + a live "Test connection."
- macOS path is built + tested here; Windows PowerShell path written carefully and flagged
  as needing a Windows test before release (documented honestly in the README).

## 11. Privacy & security
- 100% local; no server operated by the author; no telemetry.
- Only outbound traffic is the CLI agent's own subscription-authenticated calls to
  Anthropic/OpenAI — traffic the user already trusts.
- Uploads are role- and extension-checked before write; paths are sandboxed under the
  document folder; child-process arguments are passed as argv (no shell string
  interpolation) to avoid injection.

## 12. Packaging & distribution
- `electron-builder` → `.dmg` (macOS) and `.exe`/NSIS (Windows).
- Code-signing + notarization is a release step requiring Tucker's Apple Developer / Windows
  signing credentials; documented, not blocking local/dev builds.
- Auto-update out of scope for v1.

## 13. License & IP
- **Apache-2.0** `LICENSE`.
- `NOTICE` + per-file headers: **"Copyright © 2026 Tucker Peters. Authored independently, in
  the author's personal time."**
- Apache-2.0 gives genuine open-source reach plus explicit patent + attribution protection;
  the NOTICE unambiguously establishes personal authorship/IP.
- Repo name: `anchor`.

## 14. Testing & QA strategy
- **Unit:** extractors (PDF text/positions, DOCX footnotes, register parser), graph builder,
  AI-output validator/repair, work-state merge/cascade.
- **Integration:** end-to-end build job on a real fixture (start with
  `~/Schedule_H_Preexisting_IP.docx/pdf`; add a footnote-rich fixture).
- **UI/e2e:** Playwright against the running renderer (import → analyze → review → export).
- **AI engine:** mock CLI (a fake `claude`/`codex` returning canned/broken JSON) to prove
  validation, retry, and deterministic degradation without spending real quota.
- **Skill reviews (driven by PM):** `/plan-ceo-review`, `/plan-eng-review`,
  `/plan-design-review` on the plan; `/design-review` on the running UI; `/qa` end-to-end.

## 15. Build phases / milestones
1. **Scaffold** — Electron + Svelte + Vite + Node main, IPC, local JSON store, Documents CRUD.
2. **Extractors** — pdf.js text+positions+render, DOCX footnotes, register parser.
3. **Deterministic graph builder** — full graph with zero AI + fixture tests.
4. **AI engine** — detect, headless invocation, chunked schema-validated passes, degrade/retry.
5. **Review workspace UX** — queue, focused item, PDF highlight, context, status+cascade+autosave.
6. **Map view** — graph canvas, source-reuse.
7. **Setup Wizard + installers** — macOS auto-installer (tested), Windows PowerShell (written).
8. **Polish** — design-review loop, accessibility, empty/error states.
9. **QA** — Playwright e2e + full `/qa`.
10. **Package & open-source** — electron-builder, Apache-2.0 + NOTICE, README, GitHub.

## 16. Risks & open questions
- **CLI output variance:** agents can be chatty → mitigated by strict contract + validate +
  retry + deterministic fallback; covered by the mock-CLI test.
- **Rate limits:** chunk small, checkpoint, resume; surface friendly "paused — resume later."
- **Windows path untested here:** installer written blind; flagged for a real Windows test.
- **Signing/notarization:** needs Tucker's credentials; release-time step.
- **DOCX↔PDF alignment:** footnote/claim matching across two renderings is heuristic; AI pass
  and the human queue absorb the residual uncertainty (that's the product's whole point).
