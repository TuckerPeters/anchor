<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go } from '../lib/stores.js'
  import { statusOf } from '../lib/workflow.js'
  import Icon from '../components/Icon.svelte'

  let { docId = null } = $props()
  let doc = $state(null), graph = $state(null), ws = $state(null)
  let scale = $state(1), tx = $state(0), ty = $state(0)
  let dragging = false, lastX = 0, lastY = 0
  let hoverId = $state(null)
  let reuseOnly = $state(false)

  $effect(() => {
    if (!docId) return
    ;(async () => {
      doc = await api.documents.get(docId)
      graph = await api.documents.getGraph(docId)
      ws = (await api.documents.getWorkState(docId)).workState
    })()
  })

  const COLS = { page: 40, claim: 250, footnote: 620, source: 900, target: 1220 }
  const WID = { page: 54, claim: 250, footnote: 150, source: 250, target: 170 }

  const layout = $derived.by(() => {
    if (!graph) return { nodes: [], edges: [], pos: {}, height: 600 }
    const groups = {
      page: graph.nodes.pages, claim: graph.nodes.claims, footnote: graph.nodes.footnotes,
      source: graph.nodes.sources, target: graph.nodes.targets
    }
    const pos = {}, nodes = []
    let maxCount = 0
    for (const k of Object.keys(groups)) maxCount = Math.max(maxCount, groups[k].length)
    const H = Math.max(560, maxCount * 46 + 60)
    for (const [type, arr] of Object.entries(groups)) {
      const gap = arr.length > 1 ? Math.min(64, (H - 60) / (arr.length - 1)) : 0
      const startY = arr.length > 1 ? 40 : H / 2
      arr.forEach((n, i) => {
        const x = COLS[type], y = startY + i * gap, w = WID[type], h = 30
        const st = (type === 'footnote' || type === 'source') ? statusOf(ws, n.id) : null
        const reused = type === 'source' && (n.footnoteIds?.length || 0) > 1
        pos[n.id] = { x, y, w, h }
        nodes.push({ id: n.id, type, x, y, w, h, label: labelFor(type, n), status: st, reused })
      })
    }
    return { nodes, edges: graph.edges, pos, height: H }
  })

  function labelFor(type, n) {
    if (type === 'page') return 'p' + n.number
    if (type === 'footnote') return 'fn ' + n.number
    if (type === 'claim') return (n.text || '').slice(0, 34)
    if (type === 'source') return (n.title || n.key || '').slice(0, 30)
    if (type === 'target') return (n.label || '').slice(0, 22)
    return n.id
  }

  const neighbors = $derived.by(() => {
    const m = {}
    if (!graph) return m
    for (const e of graph.edges) { (m[e.from] ||= new Set()).add(e.to); (m[e.to] ||= new Set()).add(e.from) }
    return m
  })

  function edgePath(e) {
    const a = layout.pos[e.from], b = layout.pos[e.to]
    if (!a || !b) return ''
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2
    const mx = (x1 + x2) / 2
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
  }
  function dim(id) {
    if (reuseOnly) {
      const keep = layout.nodes.filter((n) => n.reused).map((n) => n.id)
      const ok = new Set(keep)
      for (const k of keep) for (const nb of (neighbors[k] || [])) ok.add(nb)
      if (!ok.has(id)) return true
    }
    if (hoverId && id !== hoverId && !(neighbors[hoverId]?.has(id))) return true
    return false
  }
  function edgeDim(e) { return dim(e.from) || dim(e.to) }

  function onWheel(ev) {
    ev.preventDefault()
    const f = ev.deltaY < 0 ? 1.1 : 1 / 1.1
    scale = Math.max(0.3, Math.min(2.5, scale * f))
  }
  function onDown(ev) { dragging = true; lastX = ev.clientX; lastY = ev.clientY }
  function onMove(ev) { if (!dragging) return; tx += ev.clientX - lastX; ty += ev.clientY - lastY; lastX = ev.clientX; lastY = ev.clientY }
  function onUp() { dragging = false }
  function reset() { scale = 1; tx = 0; ty = 0 }

  const colorFor = (type) => ({ page: 'var(--text-3)', claim: 'var(--accent)', footnote: 'var(--text-2)', source: 'var(--st-done)', target: 'var(--st-progress)' }[type])
</script>

<div class="wrap">
  <header class="hd">
    <button class="back" onclick={() => go('review', { docId })} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
    <div class="tt"><h1>Map</h1><span class="muted">{doc?.title || ''}</span></div>
    <nav class="tabs">
      <button class="tab" onclick={() => go('review', { docId })}>Review</button>
      <button class="tab active">Map</button>
      <button class="tab" onclick={() => go('handoff', { docId })}>Handoff</button>
    </nav>
    <div class="spacer"></div>
    <button class="btn sm" class:on={reuseOnly} onclick={() => (reuseOnly = !reuseOnly)}><Icon name="reuse" size={14} /> Reused sources</button>
    <button class="btn sm ghost" onclick={reset}><Icon name="refresh" size={14} /> Reset</button>
  </header>

  <div class="legend">
    {#each [['page', 'Page'], ['claim', 'Claim'], ['footnote', 'Footnote'], ['source', 'Source'], ['target', 'Cross-ref']] as [t, l]}
      <span class="lg"><span class="sw" style="background:{colorFor(t)}"></span>{l}</span>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="canvas" onwheel={onWheel} onpointerdown={onDown} onpointermove={onMove} onpointerup={onUp} onpointerleave={onUp}>
    {#if graph}
      <svg width="100%" height="100%">
        <g transform="translate({tx},{ty}) scale({scale})">
          {#each layout.edges as e}
            <path d={edgePath(e)} class="edge" class:dim={edgeDim(e)} />
          {/each}
          {#each layout.nodes as n (n.id)}
            <g transform="translate({n.x},{n.y})" class="node" class:dim={dim(n.id)}
              onpointerenter={() => (hoverId = n.id)} onpointerleave={() => (hoverId = null)} role="listitem">
              <rect width={n.w} height={n.h} rx="7" class="nrect" style="--c:{colorFor(n.type)}"
                class:done={n.status === 'done'} class:blocked={n.status === 'blocked'} class:reused={n.reused} />
              <text x="9" y={n.h / 2 + 4} class="ntext">{n.label}</text>
              {#if n.status === 'done'}<circle cx={n.w - 9} cy={n.h / 2} r="4" fill="var(--st-done)" />{/if}
              {#if n.status === 'blocked'}<circle cx={n.w - 9} cy={n.h / 2} r="4" fill="var(--st-blocked)" />{/if}
            </g>
          {/each}
        </g>
      </svg>
    {/if}
    <div class="hint faint">Scroll to zoom · drag to pan</div>
  </div>
</div>

<style>
  .wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .hd { display: flex; align-items: center; gap: 12px; padding: 12px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .back { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; }
  .back:hover { background: var(--surface-2); color: var(--text); }
  .tt { display: flex; flex-direction: column; }
  .tt h1 { font-size: var(--fs-15); font-weight: 640; }
  .tt span { font-size: var(--fs-11); }
  .tabs { display: flex; gap: 2px; background: var(--surface-3); padding: 3px; border-radius: var(--r-2); margin-left: 6px; }
  .tab { padding: 5px 13px; border-radius: var(--r-1); border: none; background: transparent; color: var(--text-2); font-size: var(--fs-13); font-weight: 550; cursor: pointer; }
  .tab.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-1); }
  .spacer { flex: 1; }
  .btn.on { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }

  .legend { display: flex; gap: 16px; padding: 8px 20px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
  .lg { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-12); color: var(--text-2); }
  .sw { width: 10px; height: 10px; border-radius: 3px; }

  .canvas { flex: 1; min-height: 0; position: relative; overflow: hidden; background: var(--bg); cursor: grab; touch-action: none; }
  .canvas:active { cursor: grabbing; }
  svg { display: block; }
  .edge { fill: none; stroke: var(--border-strong); stroke-width: 1.2; opacity: 0.6; transition: opacity 120ms var(--ease); }
  .edge.dim { opacity: 0.06; }
  .node { transition: opacity 120ms var(--ease); cursor: pointer; }
  .node.dim { opacity: 0.14; }
  .nrect { fill: var(--surface); stroke: var(--c); stroke-width: 1.4; }
  .nrect.done { stroke: var(--st-done); }
  .nrect.blocked { stroke: var(--st-blocked); }
  .nrect.reused { stroke-width: 2.4; }
  .ntext { font-family: var(--font-ui); font-size: 12px; fill: var(--text); dominant-baseline: middle; }
  .hint { position: absolute; bottom: 12px; right: 16px; font-size: var(--fs-12); pointer-events: none; }
</style>
