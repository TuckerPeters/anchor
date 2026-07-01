<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { toasts, dismissToast } from '../lib/stores.js'
  import Icon from './Icon.svelte'
  import { fly } from 'svelte/transition'
</script>

<div class="toast-wrap">
  {#each $toasts as t (t.id)}
    <div class="toast" role="status" transition:fly={{ y: 16, duration: 220 }}>
      {#if t.tone === 'blocked'}<span class="dot blocked"></span>{/if}
      <span class="msg">{t.msg}</span>
      {#if t.action}
        <button class="act" onclick={() => { t.action.fn(); dismissToast(t.id) }}>
          <Icon name="undo" size={13} /> {t.action.label}
        </button>
      {/if}
      <button class="close" aria-label="Dismiss" onclick={() => dismissToast(t.id)}><Icon name="x" size={13} /></button>
    </div>
  {/each}
</div>

<style>
  .toast-wrap {
    position: fixed; left: 0; right: 0; bottom: 22px; z-index: 60;
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
  }
  .toast {
    pointer-events: auto; display: flex; align-items: center; gap: 12px;
    background: var(--text); color: var(--bg);
    padding: 9px 10px 9px 15px; border-radius: var(--r-full); box-shadow: var(--shadow-3);
    font-size: var(--fs-13); max-width: 560px;
  }
  :global(:root[data-theme="dark"]) .toast { background: #f0f1f4; color: #14171c; }
  .msg { font-weight: 500; }
  .dot.blocked { width: 8px; height: 8px; border-radius: 50%; background: var(--st-blocked); }
  .act {
    display: inline-flex; align-items: center; gap: 5px; border: none; cursor: pointer;
    background: rgba(127, 127, 127, 0.22); color: inherit; font-weight: 600;
    padding: 5px 11px; border-radius: var(--r-full); font-size: var(--fs-12);
  }
  .act:hover { background: rgba(127, 127, 127, 0.34); }
  .close { display: inline-grid; place-items: center; border: none; background: transparent; color: inherit; opacity: 0.6; cursor: pointer; padding: 4px; border-radius: 50%; }
  .close:hover { opacity: 1; }
</style>
