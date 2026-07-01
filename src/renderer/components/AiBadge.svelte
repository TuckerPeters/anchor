<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<!-- AI output is ALWAYS a labeled suggestion, never authoritative. The deterministic
     baseline remains the source of truth; this badge marks what the AI proposed. -->
<script>
  import Icon from './Icon.svelte'
  let { suggestion = null } = $props()
  const pct = $derived(suggestion?.confidence != null ? Math.round(suggestion.confidence * 100) : null)
</script>

{#if suggestion}
  <div class="ai">
    <div class="ai-head">
      <Icon name="sparkles" size={13} />
      <span>AI suggestion{suggestion.engine ? ` · ${suggestion.engine}` : ''}</span>
      {#if pct != null}<span class="conf tnum">{pct}% confident</span>{/if}
    </div>
    {#if suggestion.citationNeed}<p class="ai-body">{suggestion.citationNeed}</p>{/if}
    {#if suggestion.class}<p class="ai-body">Suggested type: <b>{suggestion.class}</b></p>{/if}
    <p class="ai-foot">A suggestion to check — not a decision. You confirm it.</p>
  </div>
{/if}

<style>
  .ai { border: 1px dashed color-mix(in srgb, var(--accent) 55%, var(--border)); background: var(--accent-weak);
    border-radius: var(--r-2); padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; }
  .ai-head { display: flex; align-items: center; gap: 6px; font-size: var(--fs-12); font-weight: 650; color: var(--accent); }
  .conf { margin-left: auto; font-size: var(--fs-11); font-weight: 600; color: var(--text-3); }
  .ai-body { font-size: var(--fs-13); color: var(--text); line-height: 1.45; }
  .ai-foot { font-size: var(--fs-11); color: var(--text-3); }
</style>
