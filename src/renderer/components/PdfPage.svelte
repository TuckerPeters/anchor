<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<!-- The hero surface: the actual page with a confidence-aware highlight. A fuzzy match is
     NEVER shown as authoritative — located / approximate / couldn't-pinpoint are distinct. -->
<script>
  import Icon from './Icon.svelte'
  import { loadPdf, renderPage } from '../lib/pdfView.js'

  let { pdfUrl = '', page = null, anchor = null, claimText = '' } = $props()

  let canvas = $state(null)
  let rendered = $state(false)
  let failed = $state(false)
  let surfaceW = $state(560)

  const state = $derived(anchor?.state || 'none')
  const bbox = $derived(anchor?.bbox || null)
  const ratio = $derived(page && page.width && page.height ? page.height / page.width : 1.294)

  $effect(() => {
    rendered = false
    failed = false
    if (!pdfUrl || !page || !canvas) return
    let alive = true
    ;(async () => {
      try {
        const doc = await loadPdf(pdfUrl)
        if (!alive || !doc) { failed = true; return }
        await renderPage(doc, page.number, canvas, surfaceW)
        if (alive) rendered = true
      } catch { if (alive) failed = true }
    })()
    return () => { alive = false }
  })

  const showReal = $derived(pdfUrl && rendered && !failed)
</script>

<div class="wrap">
  <div class="banner {state}">
    {#if state === 'located'}
      <Icon name="check" size={13} /> <span>Located on page {page?.number}</span>
    {:else if state === 'approximate'}
      <Icon name="search" size={13} /> <span>Approximate — the passage is likely near the highlight on page {page?.number}. Confirm before resolving.</span>
    {:else}
      <Icon name="alert" size={13} /> <span>Couldn't pinpoint this passage automatically. Showing page {page?.number} so you can find it.</span>
    {/if}
  </div>

  <div class="frame" bind:clientWidth={surfaceW}>
    <div class="surface" style="aspect-ratio: {1 / ratio}">
      {#if pdfUrl}
        <canvas bind:this={canvas} class:hide={!showReal}></canvas>
      {/if}
      {#if !showReal}
        <!-- Fallback page preview (used until a real PDF is imported). The claim text is
             placed where the highlight would fall, so the mark always wraps the sentence. -->
        <div class="stub-page" aria-hidden="true"><div class="lines"></div></div>
        <div class="quote-pos reading"
          style={bbox ? `top:${bbox.y * 100}%` : 'top:42%; transform:translateY(-50%)'}>
          <span class="mk {state}">{claimText}</span>
        </div>
      {:else if bbox && state !== 'none'}
        <!-- Real PDF: highlight box over the rendered canvas -->
        <div class="hl {state}"
          style="left:{bbox.x * 100}%; top:{bbox.y * 100}%; width:{bbox.w * 100}%; height:{Math.max(bbox.h * 100, 2.4)}%"></div>
      {/if}
    </div>
    <div class="pagelabel tnum">Page {page?.number}</div>
  </div>
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .banner {
    display: flex; align-items: center; gap: 7px; font-size: var(--fs-12); font-weight: 500;
    padding: 7px 11px; border-radius: var(--r-2); line-height: 1.35;
  }
  .banner.located { color: var(--st-done-fg); background: var(--st-done-bg); }
  .banner.approximate { color: var(--st-progress-fg); background: var(--st-progress-bg); }
  .banner.none { color: var(--st-blocked-fg); background: var(--st-blocked-bg); }

  .frame {
    position: relative; background: var(--surface-3); border-radius: var(--r-3);
    padding: 22px; display: flex; justify-content: center;
  }
  :global(:root[data-theme="dark"]) .frame { background: #0a0c10; }
  .surface {
    position: relative; width: 100%; max-width: 620px; background: #ffffff;
    border-radius: 3px; box-shadow: var(--shadow-2); overflow: hidden;
  }
  canvas { display: block; width: 100%; height: auto; }
  canvas.hide { display: none; }

  .stub-page { position: absolute; inset: 0; background: #ffffff; }
  .lines {
    position: absolute; inset: 9% 10%;
    background: repeating-linear-gradient(180deg, #e9e7e1 0 1px, transparent 1px 22px);
    opacity: 0.85;
  }
  .quote-pos { position: absolute; left: 10%; right: 10%; text-align: left; }
  .mk { font-size: 15px; line-height: 1.7; color: #1c1c1c; box-decoration-break: clone; -webkit-box-decoration-break: clone; padding: 1px 2px; border-radius: 2px; }
  .mk.located { background: var(--hl); box-shadow: 0 0 0 1px var(--hl-border); }
  .mk.approximate { background: var(--hl-approx); box-shadow: 0 0 0 1px var(--st-progress); }
  .mk.none { background: transparent; }

  .hl {
    position: absolute; border-radius: 2px; pointer-events: none;
    background: var(--hl); box-shadow: inset 0 0 0 1.5px var(--hl-border);
    animation: pulse 1.4s var(--ease) 1;
  }
  .hl.approximate { background: var(--hl-approx); box-shadow: inset 0 0 0 1.5px var(--st-progress); border: 1px dashed var(--st-progress); }
  @keyframes pulse { 0% { box-shadow: inset 0 0 0 1.5px var(--hl-border), 0 0 0 6px rgba(255,204,74,0.35); } 100% { box-shadow: inset 0 0 0 1.5px var(--hl-border), 0 0 0 0 rgba(255,204,74,0); } }

  .pagelabel { position: absolute; bottom: 8px; right: 14px; font-size: var(--fs-11); color: var(--text-3); font-weight: 550; }
</style>
