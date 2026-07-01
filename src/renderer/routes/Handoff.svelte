<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go, toast } from '../lib/stores.js'
  import { coverage, buildQueue } from '../lib/workflow.js'
  import { buildHandoffMarkdown, download } from '../lib/handoff.js'
  import Icon from '../components/Icon.svelte'
  import ProgressRing from '../components/ProgressRing.svelte'

  let { docId = null } = $props()
  let doc = $state(null), graph = $state(null), ws = $state(null), loading = $state(true)

  $effect(() => {
    if (!docId) return
    ;(async () => {
      loading = true
      doc = await api.documents.get(docId)
      graph = await api.documents.getGraph(docId)
      ws = (await api.documents.getWorkState(docId)).workState
      loading = false
    })()
  })

  const cov = $derived(graph && ws ? coverage(graph, ws) : null)
  const q = $derived(graph && ws ? buildQueue(graph, ws) : [])
  const blocked = $derived(q.filter((it) => it.status === 'blocked'))
  const slug = $derived((doc?.title || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))

  function exportMarkdown() {
    download(`${slug}-handoff.md`, buildHandoffMarkdown(doc, graph, ws))
    toast('Handoff report exported')
  }
  function exportJson() {
    download(`${slug}-work-state.json`, JSON.stringify(ws, null, 2), 'application/json')
    toast('Work state exported')
  }
</script>

<div class="wrap">
  <header class="hd">
    <button class="back" onclick={() => go('review', { docId })} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
    <div><h1>Handoff</h1><p class="muted">{doc?.title || ''}</p></div>
  </header>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else if cov}
    <div class="dash">
      <div class="ring-card card">
        <ProgressRing value={cov.pct} size={92} stroke={7} label={false} />
        <div class="ring-mid tnum">{cov.pct}<i>%</i></div>
        <div class="ring-cap">resolved</div>
      </div>
      <div class="stats-grid">
        <div class="stat card"><b class="tnum done">{cov.done}</b><span>Resolved</span></div>
        <div class="stat card"><b class="tnum">{cov.todo + cov.inProgress}</b><span>Still open</span></div>
        <div class="stat card"><b class="tnum bl">{cov.blocked}</b><span>Blocked</span></div>
        <div class="stat card"><b class="tnum">{cov.total}</b><span>Citations</span></div>
      </div>
    </div>

    {#if blocked.length}
      <section class="blocked">
        <h3><Icon name="x" size={14} /> Blocked — the next reviewer needs to decide</h3>
        {#each blocked as it (it.id)}
          <div class="brow">
            <span class="fn tnum">fn {it.footnote.number}</span>
            <div class="btext">
              <span class="reading">{it.claims[0]?.text || it.footnote.rawText}</span>
              {#if ws.nodes[it.nodeId]?.note}<span class="bnote">{ws.nodes[it.nodeId].note}</span>{/if}
            </div>
          </div>
        {/each}
      </section>
    {/if}

    <section class="exports">
      <h3>Export</h3>
      <div class="ex-grid">
        <button class="ex card" onclick={exportMarkdown}>
          <div class="ex-icon acc"><Icon name="file" size={18} /></div>
          <div><div class="ex-t">Handoff report</div><div class="ex-d muted">Readable Markdown — blocked items first, every finding kept, keyed to page + footnote.</div></div>
          <Icon name="download" size={16} />
        </button>
        <button class="ex card" onclick={exportJson}>
          <div class="ex-icon"><Icon name="layers" size={18} /></div>
          <div><div class="ex-t">Work state (JSON)</div><div class="ex-d muted">The raw review data, to re-open later or hand to another Anchor user.</div></div>
          <Icon name="download" size={16} />
        </button>
      </div>
      <p class="privacy faint"><Icon name="lock" size={12} /> Exports are written straight to your machine. Nothing is uploaded.</p>
    </section>
  {/if}
</div>

<style>
  .wrap { max-width: 760px; width: 100%; margin: 0 auto; padding: 34px 30px 60px; }
  .hd { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 26px; }
  .back { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; flex: none; margin-top: 2px; }
  .back:hover { background: var(--surface-2); color: var(--text); }
  h1 { font-size: var(--fs-26); font-weight: 680; letter-spacing: -0.02em; }
  .hd p { margin-top: 4px; }

  .dash { display: grid; grid-template-columns: auto 1fr; gap: 16px; margin-bottom: 24px; }
  .ring-card { position: relative; display: grid; place-items: center; padding: 20px 28px; }
  .ring-mid { position: absolute; font-size: var(--fs-21); font-weight: 700; }
  .ring-mid i { font-size: 0.6em; color: var(--text-3); font-style: normal; }
  .ring-cap { position: absolute; bottom: 22px; font-size: var(--fs-11); color: var(--text-3); }
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat { padding: 16px; display: flex; flex-direction: column; gap: 4px; }
  .stat b { font-size: var(--fs-26); font-weight: 700; }
  .stat b.done { color: var(--st-done); } .stat b.bl { color: var(--st-blocked); }
  .stat span { font-size: var(--fs-12); color: var(--text-2); }

  section { margin-top: 26px; }
  section h3 { font-size: var(--fs-14); font-weight: 640; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 7px; }
  .blocked h3 { color: var(--st-blocked-fg); }
  .brow { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid var(--border); }
  .brow:first-of-type { border-top: none; }
  .fn { flex: none; font-size: var(--fs-11); font-weight: 650; color: var(--st-blocked-fg); background: var(--st-blocked-bg); padding: 3px 8px; border-radius: var(--r-1); height: fit-content; }
  .btext { display: flex; flex-direction: column; gap: 4px; font-size: var(--fs-14); line-height: 1.5; }
  .bnote { font-size: var(--fs-13); color: var(--text-2); }

  .ex-grid { display: flex; flex-direction: column; gap: 12px; }
  .ex { display: flex; align-items: center; gap: 14px; padding: 16px; text-align: left; cursor: pointer; }
  .ex:hover { border-color: var(--border-strong); background: var(--surface-2); }
  .ex-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--surface-3); color: var(--text-2); flex: none; }
  .ex-icon.acc { background: var(--accent-weak); color: var(--accent); }
  .ex > div:nth-child(2) { flex: 1; }
  .ex-t { font-weight: 600; font-size: var(--fs-14); }
  .ex-d { font-size: var(--fs-12); margin-top: 2px; line-height: 1.45; }
  .ex :global(svg:last-child) { color: var(--text-3); }
  .privacy { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-12); margin-top: 12px; }
</style>
