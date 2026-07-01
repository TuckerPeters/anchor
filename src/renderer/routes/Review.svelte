<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go, toast } from '../lib/stores.js'
  import { buildQueue, coverage, STATUS_META, RESOLVE_HINTS, QUEUE_KINDS } from '../lib/workflow.js'
  import Icon from '../components/Icon.svelte'
  import QueueList from '../components/QueueList.svelte'
  import ContextRail from '../components/ContextRail.svelte'
  import PdfPage from '../components/PdfPage.svelte'
  import StatusPicker from '../components/StatusPicker.svelte'
  import AiBadge from '../components/AiBadge.svelte'

  let { docId = null } = $props()

  let doc = $state(null)
  let graph = $state(null)
  let ws = $state(null)
  let pdfUrl = $state('')
  let loading = $state(true)
  let selectedId = $state(null)
  let orphanCount = $state(0)
  let showKeys = $state(false)

  const isOpen = (it) => it.status === 'todo' || it.status === 'in-progress'
  const queue = $derived(graph && ws ? buildQueue(graph, ws) : [])
  const cov = $derived(graph && ws ? coverage(graph, ws) : null)
  const selected = $derived(queue.find((i) => i.id === selectedId) || null)
  const claim = $derived(selected?.claims?.[0] || null)
  const page = $derived(claim && graph ? graph.nodes.pages.find((p) => p.id === claim.pageId) : null)
  const node = $derived(selected && ws ? (ws.nodes[selected.nodeId] || { status: 'todo', substep: null, note: '', resolution: '' }) : null)
  const kindMeta = $derived(selected ? QUEUE_KINDS.find((k) => k.key === selected.kind) : null)

  let saveTimer = null
  function scheduleSave() {
    clearTimeout(saveTimer)
    const snap = $state.snapshot(ws)
    saveTimer = setTimeout(() => api.documents.saveWorkState(docId, snap), 450)
  }

  function writeNode(id, patch, undoLabel, tone) {
    const prev = ws.nodes[id] ? { ...ws.nodes[id] } : null
    const cur = ws.nodes[id] || { status: 'todo', substep: null, note: '', resolution: '', seq: 0 }
    ws.nodes[id] = { ...cur, ...patch, updatedAt: new Date().toISOString(), seq: (cur.seq || 0) + 1 }
    scheduleSave()
    if (undoLabel) {
      toast(undoLabel, { tone, action: { label: 'Undo', fn: () => { if (prev) ws.nodes[id] = prev; else delete ws.nodes[id]; scheduleSave() } } })
    }
  }

  function setStatus(status, substep) {
    if (!selected) return
    const label = STATUS_META[status].label
    writeNode(selected.nodeId, { status, substep }, `Marked "${label}"`, status === 'blocked' ? 'blocked' : null)
  }

  function editField(field, value) {
    if (!selected) return
    writeNode(selected.nodeId, { [field]: value })
  }

  function resolveNext() {
    if (!selected) return
    const ordered = queue.filter(isOpen).map((i) => i.id)
    const idx = ordered.indexOf(selectedId)
    writeNode(selected.nodeId, { status: 'done', substep: null }, 'Marked "Done"')
    const rest = ordered.filter((id) => id !== selectedId)
    const nextId = rest[idx] ?? rest[idx - 1] ?? rest[0] ?? null
    if (nextId) selectedId = nextId
  }

  function move(delta) {
    if (!queue.length) return
    const idx = queue.findIndex((i) => i.id === selectedId)
    const next = queue[Math.max(0, Math.min(queue.length - 1, idx + delta))]
    if (next) selectedId = next.id
  }

  function onKey(e) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === '1') setStatus('todo', null)
    else if (e.key === '2') setStatus('in-progress', node?.substep || null)
    else if (e.key === '3') resolveNext()
    else if (e.key === '4') setStatus('blocked', null)
    else if (e.key === '?') showKeys = !showKeys
  }

  async function load() {
    loading = true
    doc = await api.documents.get(docId)
    const r = await api.documents.getWorkState(docId)
    ws = r.workState
    orphanCount = r.orphanCount || 0
    graph = await api.documents.getGraph(docId)
    pdfUrl = await api.assets.pdfUrl(docId)
    loading = false
    if (!selectedId) {
      const q = buildQueue(graph, ws)
      selectedId = (q.find(isOpen) || q[0])?.id || null
    }
  }

  $effect(() => { if (docId) load() })

  const aiSuggestion = $derived(selected?.footnote?.ai || selected?.source?.ai || null)
</script>

<svelte:window onkeydown={onKey} />

{#if loading}
  <div class="center-msg">Loading…</div>
{:else if !graph}
  <div class="center-msg">
    <p>This report hasn't been analyzed yet.</p>
    <button class="btn primary" onclick={() => go('import', { docId })}>Import documents</button>
  </div>
{:else}
  <div class="rv">
    <!-- Header -->
    <header class="rv-head">
      <button class="back" onclick={() => go('documents')} aria-label="Back to documents"><Icon name="arrowLeft" size={16} /></button>
      <div class="titlewrap">
        <h1 class="title">{doc?.title}</h1>
        <span class="local"><Icon name="lock" size={11} /> On this machine</span>
      </div>
      <nav class="tabs">
        <button class="tab active">Review</button>
        <button class="tab" onclick={() => go('map', { docId })}>Map</button>
        <button class="tab" onclick={() => go('handoff', { docId })}>Handoff</button>
      </nav>
      <div class="spacer"></div>
      {#if cov}
        <div class="cov"><b class="tnum">{cov.done}</b> <span class="faint">/ {cov.total} resolved</span></div>
      {/if}
      <button class="btn sm" onclick={() => go('setup')}><Icon name="sparkles" size={14} /> Enhance with AI</button>
    </header>

    {#if orphanCount > 0}
      <div class="orphan"><Icon name="alert" size={13} /> {orphanCount} earlier note{orphanCount > 1 ? 's' : ''} no longer match the current document and were set aside.</div>
    {/if}

    <!-- Body: queue | focus | context -->
    <div class="rv-body">
      <section class="pane queue"><QueueList {queue} {selectedId} onselect={(id) => (selectedId = id)} /></section>

      <section class="pane focus">
        {#if selected}
          <div class="focus-inner">
            <!-- 1. The task, first -->
            <div class="task">
              <div class="task-top">
                <span class="fn-badge tnum">Footnote {selected.footnote.number}</span>
                <span class="kind-badge">{kindMeta?.label}</span>
              </div>
              <h2 class="uncertain">{selected.footnote.citationNeed || selected.source?.citationNeed || 'Review this citation.'}</h2>
              {#if aiSuggestion}<AiBadge suggestion={aiSuggestion} />{/if}
              <p class="tohint"><span class="tolab">To resolve</span> {RESOLVE_HINTS[selected.kind]}</p>
            </div>

            <!-- 2. The page (trust anchor) -->
            <PdfPage {pdfUrl} {page} anchor={claim?.anchor} claimText={claim?.text || ''} />

            <!-- 3. Supporting detail -->
            <div class="detail">
              <h4 class="dlbl">Footnote text</h4>
              <p class="raw reading">{selected.footnote.rawText}</p>
              {#if claim}
                <h4 class="dlbl">The claim it supports</h4>
                <p class="raw reading">{claim.text}</p>
              {/if}
            </div>

            <!-- 4. Record what you found -->
            <div class="fields">
              <label class="field">
                <span>What you found <i class="faint">(carried into the handoff)</i></span>
                <textarea rows="2" placeholder="e.g. Confirmed docket EE-2019-BT-STD-0022, filed May 2019."
                  value={node.resolution || ''} oninput={(e) => editField('resolution', e.target.value)}></textarea>
              </label>
              <label class="field">
                <span>Private note</span>
                <textarea rows="1" placeholder="Anything the next reviewer should know…"
                  value={node.note || ''} oninput={(e) => editField('note', e.target.value)}></textarea>
              </label>
            </div>
          </div>

          <!-- 5. Pinned action bar -->
          <div class="actionbar">
            <StatusPicker status={node.status} substep={node.substep} onchange={setStatus} />
            <div class="spacer"></div>
            <button class="btn ghost sm keys-btn" onclick={() => (showKeys = !showKeys)} title="Keyboard shortcuts"><Icon name="keyboard" size={15} /></button>
            <button class="btn primary" onclick={resolveNext}><Icon name="check" size={15} /> Done &amp; next</button>
          </div>
        {:else}
          <div class="all-clear">
            <div class="ac-mark"><Icon name="check" size={30} /></div>
            <h2>Every citation is resolved.</h2>
            <p class="muted">Nothing left in the queue. Head to Handoff to export a clean report for the next reviewer.</p>
            <button class="btn primary" onclick={() => go('handoff', { docId })}><Icon name="download" size={15} /> Go to handoff</button>
          </div>
        {/if}
      </section>

      <section class="pane context">
        {#if selected}<ContextRail item={selected} {graph} />{/if}
      </section>
    </div>
  </div>
{/if}

{#if showKeys}
  <div class="keys" role="dialog" aria-label="Keyboard shortcuts" onclick={() => (showKeys = false)} onkeydown={(e) => e.key === 'Escape' && (showKeys = false)} tabindex="-1">
    <div class="keys-card card" onclick={(e) => e.stopPropagation()}>
      <h3>Keyboard shortcuts</h3>
      <div class="krow"><kbd>J</kbd> <kbd>K</kbd> <span>Next / previous citation</span></div>
      <div class="krow"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> <span>To do · In progress · Done &amp; next · Blocked</span></div>
      <div class="krow"><kbd>?</kbd> <span>Toggle this help</span></div>
      <p class="faint">Every action also has a button — the keyboard is only a shortcut.</p>
    </div>
  </div>
{/if}

<style>
  .center-msg { flex: 1; display: flex; flex-direction: column; gap: 14px; align-items: center; justify-content: center; color: var(--text-2); }
  .rv { flex: 1; min-height: 0; display: flex; flex-direction: column; }

  .rv-head { display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .back { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; }
  .back:hover { background: var(--surface-2); color: var(--text); }
  .titlewrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .title { font-size: var(--fs-15); font-weight: 640; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
  .local { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-11); color: var(--text-3); }
  .tabs { display: flex; gap: 2px; background: var(--surface-3); padding: 3px; border-radius: var(--r-2); margin-left: 6px; }
  .tab { padding: 5px 13px; border-radius: var(--r-1); border: none; background: transparent; color: var(--text-2); font-size: var(--fs-13); font-weight: 550; cursor: pointer; }
  .tab:hover { color: var(--text); }
  .tab.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); }
  .spacer { flex: 1; }
  .cov { font-size: var(--fs-13); color: var(--text); } .cov b { font-weight: 700; }
  .orphan { display: flex; align-items: center; gap: 7px; font-size: var(--fs-12); color: var(--st-progress-fg); background: var(--st-progress-bg); padding: 7px 18px; }

  .rv-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 340px minmax(0, 1fr) 320px; }
  .pane { min-height: 0; overflow: hidden; }
  .queue { border-right: 1px solid var(--border); padding: 16px 12px; background: var(--surface); }
  .focus { overflow-y: auto; background: var(--bg); }
  .context { border-left: 1px solid var(--border); padding: 16px 14px; background: var(--surface); }
  @media (max-width: 1180px) { .rv-body { grid-template-columns: 300px minmax(0, 1fr); } .context { display: none; } }

  .focus-inner { max-width: 720px; margin: 0 auto; padding: 24px 28px 24px; display: flex; flex-direction: column; gap: 22px; }
  .task { display: flex; flex-direction: column; gap: 10px; }
  .task-top { display: flex; align-items: center; gap: 8px; }
  .fn-badge { font-size: var(--fs-12); font-weight: 650; color: var(--text-2); background: var(--surface-3); padding: 3px 10px; border-radius: var(--r-full); }
  .kind-badge { font-size: var(--fs-11); font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); }
  .uncertain { font-size: var(--fs-21); font-weight: 660; line-height: 1.3; letter-spacing: -0.01em; }
  .tohint { font-size: var(--fs-14); color: var(--text-2); line-height: 1.55; }
  .tolab { display: inline-block; font-size: var(--fs-11); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); margin-right: 7px; }

  .detail { display: flex; flex-direction: column; gap: 6px; }
  .dlbl { font-size: var(--fs-11); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-3); font-weight: 650; margin-top: 8px; }
  .raw { font-size: var(--fs-15); line-height: 1.6; color: var(--text); }

  .fields { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border); padding-top: 18px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field > span { font-size: var(--fs-13); font-weight: 550; color: var(--text-2); }
  textarea { width: 100%; resize: vertical; padding: 10px 12px; border-radius: var(--r-2); border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); font-family: inherit; font-size: var(--fs-14); line-height: 1.5; }
  textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

  .actionbar { position: sticky; bottom: 0; z-index: 5; width: 100%; max-width: 776px; margin: 0 auto;
    display: flex; align-items: center; gap: 10px; padding: 14px 28px; background: var(--bg);
    border-top: 1px solid var(--border); box-shadow: 0 -8px 20px -12px rgba(10,12,16,0.25); flex-wrap: wrap; }
  .keys-btn { padding: 7px 9px; }

  .all-clear { max-width: 460px; margin: 60px auto; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .ac-mark { width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center; background: var(--st-done-bg); color: var(--st-done); }
  .all-clear h2 { font-size: var(--fs-21); font-weight: 660; }
  .all-clear p { font-size: var(--fs-14); }

  .keys { position: fixed; inset: 0; background: rgba(10,12,16,0.4); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 55; }
  .keys-card { padding: 22px 24px; width: 420px; display: flex; flex-direction: column; gap: 12px; }
  .keys-card h3 { font-size: var(--fs-16); font-weight: 640; }
  .krow { display: flex; align-items: center; gap: 8px; font-size: var(--fs-13); color: var(--text-2); }
  kbd { font-family: var(--font-mono); font-size: var(--fs-12); background: var(--surface-3); border: 1px solid var(--border-strong); border-bottom-width: 2px; border-radius: 5px; padding: 2px 7px; color: var(--text); }
  .krow span { margin-left: 4px; }
</style>
