<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go } from '../lib/stores.js'
  import { coverage } from '../lib/workflow.js'
  import Icon from '../components/Icon.svelte'
  import ProgressRing from '../components/ProgressRing.svelte'

  let items = $state([])
  let loading = $state(true)
  let showNew = $state(false)
  let newTitle = $state('')

  async function load() {
    loading = true
    const docs = await api.documents.list()
    const enriched = await Promise.all(docs.map(async (doc) => {
      let graph = null, ws = null, cov = null
      try {
        graph = await api.documents.getGraph(doc.id)
        const r = await api.documents.getWorkState(doc.id)
        ws = r.workState
        if (graph) cov = coverage(graph, ws)
      } catch { /* not analyzed yet */ }
      return { doc, graph, cov }
    }))
    items = enriched
    loading = false
  }

  $effect(() => { load() })

  function openDoc(it) {
    if (it.graph) go('review', { docId: it.doc.id })
    else go('import', { docId: it.doc.id })
  }

  async function createDoc() {
    const title = newTitle.trim() || 'Untitled report'
    const doc = await api.documents.create({ title })
    showNew = false
    newTitle = ''
    go('import', { docId: doc.id })
  }

  function fmtDate(s) {
    if (!s) return ''
    try { return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
  }

  const demo = $derived(items.find((i) => i.doc.isDemo))
  const mine = $derived(items.filter((i) => !i.doc.isDemo))

  function onKey(e) { if (showNew && e.key === 'Escape') showNew = false }
</script>

<svelte:window onkeydown={onKey} />

<div class="page">
  <div class="head">
    <div>
      <h1>Your reports</h1>
      <p class="muted">Resolve every uncertain citation before handoff. Everything stays on this machine.</p>
    </div>
    <button class="btn primary" onclick={() => (showNew = true)}><Icon name="plus" size={16} /> New report</button>
  </div>

  {#if loading}
    <div class="grid">
      {#each Array(3) as _}<div class="card skel"></div>{/each}
    </div>
  {:else}
    {#if demo}
      <section>
        <h3 class="sect">Sample</h3>
        <div class="grid">
          <button class="card doc demo" onclick={() => openDoc(demo)}>
            <div class="ribbon"><Icon name="book" size={12} /> Sample report</div>
            <div class="doc-top">
              <h2 class="title">{demo.doc.title}</h2>
              {#if demo.cov}<ProgressRing value={demo.cov.pct} size={46} />{/if}
            </div>
            <p class="sub muted">Explore the review workflow. Nothing here is confidential — experiment freely.</p>
            {#if demo.cov}
              <div class="stats">
                <span>{demo.doc.stats.footnotes} footnotes</span><i>·</i>
                <span>{demo.doc.stats.sources} sources</span>
                {#if demo.cov.blocked}<i>·</i><span class="bl">{demo.cov.blocked} blocked</span>{/if}
              </div>
            {/if}
          </button>
        </div>
      </section>
    {/if}

    <section>
      <h3 class="sect">Your documents</h3>
      {#if mine.length === 0}
        <div class="empty card">
          <div class="empty-mark"><Icon name="file" size={22} /></div>
          <div>
            <h2>No reports yet</h2>
            <p class="muted">Create a report, then drop in your Word draft and the rendered PDF. Anchor maps every citation for you.</p>
          </div>
          <button class="btn primary" onclick={() => (showNew = true)}><Icon name="plus" size={16} /> New report</button>
        </div>
      {:else}
        <div class="grid">
          {#each mine as it (it.doc.id)}
            <button class="card doc" onclick={() => openDoc(it)}>
              <div class="doc-top">
                <h2 class="title">{it.doc.title}</h2>
                {#if it.cov}<ProgressRing value={it.cov.pct} size={46} />{:else}<span class="badge">Not analyzed</span>{/if}
              </div>
              {#if it.cov}
                <div class="stats">
                  <span>{it.doc.stats.footnotes ?? '—'} footnotes</span><i>·</i>
                  <span>{it.doc.stats.sources ?? '—'} sources</span>
                </div>
                <div class="summary">
                  {#if it.cov.blocked}<span class="bl"><Icon name="x" size={12} /> {it.cov.blocked} blocked</span>{/if}
                  {#if it.cov.todo}<span class="td">{it.cov.todo} to do</span>{/if}
                  {#if it.cov.done === it.cov.total && it.cov.total > 0}<span class="allclear"><Icon name="check" size={12} /> All clear</span>{/if}
                </div>
              {:else}
                <p class="sub muted">Ready to import your documents.</p>
              {/if}
              <div class="foot faint">{fmtDate(it.doc.updatedAt)}</div>
            </button>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if showNew}
  <div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
    onclick={(e) => { if (e.target === e.currentTarget) showNew = false }}
    onkeydown={(e) => { if (e.key === 'Escape') showNew = false }}>
    <div class="modal card">
      <h2>New report</h2>
      <p class="muted">Give it a name you'll recognize. You can rename it later.</p>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" placeholder="e.g. Andersen — Technical Report" bind:value={newTitle} autofocus
        onkeydown={(e) => { if (e.key === 'Enter') createDoc(); if (e.key === 'Escape') showNew = false }} />
      <div class="modal-actions">
        <button class="btn ghost" onclick={() => (showNew = false)}>Cancel</button>
        <button class="btn primary" onclick={createDoc}>Create</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page { max-width: 1040px; width: 100%; margin: 0 auto; padding: 34px 30px 60px; }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 26px; }
  h1 { font-size: var(--fs-26); font-weight: 680; letter-spacing: -0.02em; }
  .head p { margin-top: 5px; font-size: var(--fs-14); }
  .sect { font-size: var(--fs-12); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); font-weight: 650; margin: 22px 2px 12px; }
  section:first-of-type .sect { margin-top: 4px; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 16px; }

  .doc {
    text-align: left; cursor: pointer; padding: 18px; display: flex; flex-direction: column; gap: 10px;
    min-height: 148px; transition: transform 120ms var(--ease), box-shadow 120ms var(--ease), border-color 120ms var(--ease);
    position: relative; color: inherit;
  }
  .doc:hover { transform: translateY(-2px); box-shadow: var(--shadow-2); border-color: var(--border-strong); }
  .doc.demo { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); background: linear-gradient(180deg, var(--accent-weak), var(--surface) 60%); }
  .ribbon { display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; font-size: var(--fs-11); font-weight: 650;
    color: var(--accent); background: var(--surface); border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border)); padding: 3px 8px; border-radius: var(--r-full); }
  .doc-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .title { font-size: var(--fs-16); font-weight: 620; line-height: 1.3; letter-spacing: -0.01em; }
  .sub { font-size: var(--fs-13); line-height: 1.45; }
  .stats { display: flex; align-items: center; gap: 7px; font-size: var(--fs-13); color: var(--text-2); }
  .stats i { color: var(--text-3); }
  .summary { display: flex; align-items: center; gap: 10px; font-size: var(--fs-12); font-weight: 550; margin-top: 2px; }
  .summary .bl, .stats .bl { color: var(--st-blocked); display: inline-flex; align-items: center; gap: 3px; }
  .summary .td { color: var(--text-2); }
  .summary .allclear { color: var(--st-done); display: inline-flex; align-items: center; gap: 4px; }
  .badge { font-size: var(--fs-11); color: var(--text-3); border: 1px solid var(--border); padding: 3px 8px; border-radius: var(--r-full); white-space: nowrap; }
  .foot { font-size: var(--fs-12); margin-top: auto; }

  .empty { display: flex; align-items: center; gap: 18px; padding: 26px; }
  .empty-mark { width: 46px; height: 46px; border-radius: 12px; background: var(--surface-3); color: var(--text-2); display: grid; place-items: center; flex: none; }
  .empty h2 { font-size: var(--fs-16); font-weight: 620; }
  .empty p { font-size: var(--fs-13); margin-top: 3px; max-width: 52ch; }
  .empty .btn { margin-left: auto; flex: none; }

  .skel { height: 148px; background: linear-gradient(90deg, var(--surface-2), var(--surface-3), var(--surface-2)); background-size: 200% 100%; animation: sh 1.3s infinite; }
  @keyframes sh { to { background-position: -200% 0; } }

  .overlay { position: fixed; inset: 0; background: rgba(10, 12, 16, 0.4); backdrop-filter: blur(3px);
    display: grid; place-items: center; z-index: 50; padding: 20px; }
  .modal { width: 440px; max-width: 100%; padding: 24px; box-shadow: var(--shadow-3); }
  .modal h2 { font-size: var(--fs-18); font-weight: 640; }
  .modal p { margin-top: 4px; font-size: var(--fs-13); }
  .input { width: 100%; margin-top: 16px; padding: 11px 13px; border-radius: var(--r-2); border: 1px solid var(--border-strong);
    background: var(--surface-2); color: var(--text); font-size: var(--fs-14); font-family: inherit; }
  .input:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
</style>
