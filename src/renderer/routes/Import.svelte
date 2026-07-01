<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go, toast } from '../lib/stores.js'
  import Icon from '../components/Icon.svelte'

  let { docId = null } = $props()

  let doc = $state(null)
  let files = $state({ docx: null, pdf: null, register: null })
  let dragRole = $state(null)
  let busy = $state(false)

  const SLOTS = [
    { role: 'docx', ext: '.docx', title: 'Word draft', icon: 'file', what: 'Where footnotes and their text come from.' },
    { role: 'pdf', ext: '.pdf', title: 'Rendered PDF', icon: 'book', what: 'The page each claim sits on, for the highlighted review.' },
    { role: 'register', ext: '.md', title: 'Source register', icon: 'list', what: 'Optional. A Markdown list of your sources, if you keep one.' }
  ]

  $effect(() => { if (docId) api.documents.get(docId).then((d) => { doc = d }) })

  async function accept(role, file) {
    if (!file) return
    const bytes = await file.arrayBuffer()
    files[role] = { name: file.name, bytes, size: file.size }
  }
  function onDrop(role, e) {
    e.preventDefault(); dragRole = null
    const f = e.dataTransfer?.files?.[0]
    if (f) accept(role, f)
  }
  function pick(role) {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = SLOTS.find((s) => s.role === role).ext
    inp.onchange = () => accept(role, inp.files[0])
    inp.click()
  }
  function fmtSize(n) { return n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB' }

  const canAnalyze = $derived(!!(files.docx || files.pdf))

  async function analyze() {
    if (!canAnalyze || busy) return
    busy = true
    try {
      const payload = {}
      for (const r of ['docx', 'pdf', 'register']) if (files[r]) payload[r] = { name: files[r].name, bytes: files[r].bytes }
      await api.documents.saveFiles(docId, payload)
      const { jobId } = await api.documents.build(docId)
      go('analyze', { docId, jobId })
    } catch (e) {
      busy = false
      toast(String(e?.message || e), { tone: 'blocked' })
    }
  }
</script>

<div class="wrap">
  <header class="hd">
    <button class="back" onclick={() => go('documents')} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
    <div>
      <h1>Add your documents</h1>
      <p class="muted">{doc?.title || ''} — everything stays on this machine. <span class="lock"><Icon name="lock" size={12} /> Nothing is uploaded.</span></p>
    </div>
  </header>

  <div class="slots">
    {#each SLOTS as s}
      {@const f = files[s.role]}
      <div class="slot" class:filled={f} class:drag={dragRole === s.role}
        role="button" tabindex="0"
        ondragover={(e) => { e.preventDefault(); dragRole = s.role }}
        ondragleave={() => (dragRole = null)}
        ondrop={(e) => onDrop(s.role, e)}
        onclick={() => pick(s.role)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') pick(s.role) }}>
        <div class="slot-icon"><Icon name={f ? 'check' : s.icon} size={20} /></div>
        <div class="slot-main">
          <div class="slot-title">{s.title}{#if s.role !== 'register'}<span class="req">needed</span>{:else}<span class="opt">optional</span>{/if}</div>
          {#if f}
            <div class="fname mono">{f.name} <span class="faint">· {fmtSize(f.size)}</span></div>
          {:else}
            <div class="slot-what">{s.what}</div>
            <div class="slot-drop faint">Drop {s.ext} here, or click to choose</div>
          {/if}
        </div>
        {#if f}<button class="clear" aria-label="Remove" onclick={(e) => { e.stopPropagation(); files[s.role] = null }}><Icon name="x" size={14} /></button>{/if}
      </div>
    {/each}
  </div>

  <div class="foot">
    <p class="hint faint">
      {#if !canAnalyze}Add at least a Word draft or a PDF to begin.{:else if !files.pdf}Without the PDF, Anchor maps citations but can't show the highlighted page.{:else if !files.docx}Without the Word draft, footnote text may be incomplete.{:else}Ready. Anchor will map every citation and never send anything off this machine.{/if}
    </p>
    <button class="btn primary lg" disabled={!canAnalyze || busy} onclick={analyze}>
      {#if busy}Starting…{:else}<Icon name="sparkles" size={16} /> Analyze report{/if}
    </button>
  </div>
</div>

<style>
  .wrap { max-width: 720px; width: 100%; margin: 0 auto; padding: 34px 30px 60px; }
  .hd { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 28px; }
  .back { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; flex: none; margin-top: 2px; }
  .back:hover { background: var(--surface-2); color: var(--text); }
  h1 { font-size: var(--fs-26); font-weight: 680; letter-spacing: -0.02em; }
  .hd p { margin-top: 5px; font-size: var(--fs-14); }
  .lock { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); }

  .slots { display: flex; flex-direction: column; gap: 12px; }
  .slot { display: flex; align-items: center; gap: 16px; padding: 18px; border: 1.5px dashed var(--border-strong); border-radius: var(--r-3); background: var(--surface); cursor: pointer; transition: border-color 120ms var(--ease), background 120ms var(--ease); position: relative; }
  .slot:hover { border-color: var(--text-3); background: var(--surface-2); }
  .slot.drag { border-color: var(--accent); background: var(--accent-weak); border-style: solid; }
  .slot.filled { border-style: solid; border-color: var(--st-done); background: var(--st-done-bg); }
  .slot-icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--surface-3); color: var(--text-2); flex: none; }
  .slot.filled .slot-icon { background: var(--st-done); color: #fff; }
  .slot-main { flex: 1; min-width: 0; }
  .slot-title { font-size: var(--fs-15); font-weight: 620; display: flex; align-items: center; gap: 8px; }
  .req, .opt { font-size: var(--fs-11); font-weight: 600; padding: 1px 7px; border-radius: var(--r-full); }
  .req { color: var(--text-3); background: var(--surface-3); }
  .opt { color: var(--text-3); border: 1px solid var(--border); }
  .slot-what { font-size: var(--fs-13); color: var(--text-2); margin-top: 3px; }
  .slot-drop { font-size: var(--fs-12); margin-top: 5px; }
  .fname { font-size: var(--fs-13); color: var(--st-done-fg); margin-top: 3px; word-break: break-all; }
  .clear { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: none; background: transparent; color: var(--text-3); cursor: pointer; flex: none; }
  .clear:hover { background: var(--surface); color: var(--text); }

  .foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 26px; }
  .hint { font-size: var(--fs-13); max-width: 44ch; line-height: 1.5; }
  .btn.lg { padding: 11px 20px; font-size: var(--fs-15); }
</style>
