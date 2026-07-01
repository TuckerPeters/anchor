<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<!-- The baseline is the hero. This chip frames it positively ("Standard review"), never red,
     never "not connected". AI, when present, is shown as an available upgrade. -->
<script>
  import Icon from './Icon.svelte'
  import { api } from '../lib/api.js'
  import { go } from '../lib/stores.js'

  let state = $state({ loading: true, engine: null })

  $effect(() => {
    let alive = true
    api.ai.detect().then((d) => {
      if (!alive) return
      const engine = d.claude?.signedIn ? 'Claude' : d.codex?.signedIn ? 'Codex' : null
      state = { loading: false, engine }
    }).catch(() => { state = { loading: false, engine: null } })
    return () => { alive = false }
  })
</script>

<button class="ai" onclick={() => go('setup')} title="AI settings">
  {#if state.engine}
    <span class="d on"></span>
    <Icon name="sparkles" size={13} />
    <span>AI: {state.engine}</span>
  {:else}
    <span class="d"></span>
    <span>Standard review</span>
  {/if}
</button>

<style>
  .ai {
    display: inline-flex; align-items: center; gap: 7px;
    border: 1px solid var(--border); background: var(--surface); color: var(--text-2);
    padding: 5px 11px; border-radius: var(--r-full); font-size: var(--fs-12); font-weight: 550; cursor: pointer;
  }
  .ai:hover { background: var(--surface-2); color: var(--text); }
  .d { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); }
  .d.on { background: var(--st-done); box-shadow: 0 0 0 3px var(--st-done-bg); }
</style>
