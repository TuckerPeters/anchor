<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<!-- The one place Anchor's data leaves the machine. It must be explicit, honest, and
     per-document — never silent. (Design review B2.) -->
<script>
  import Icon from './Icon.svelte'
  let { engine = 'claude', onconfirm, oncancel } = $props()
  const provider = $derived(engine === 'codex' ? 'OpenAI' : 'Anthropic')
</script>

<div class="overlay" role="dialog" aria-modal="true" tabindex="-1"
  onclick={(e) => { if (e.target === e.currentTarget) oncancel() }}
  onkeydown={(e) => { if (e.key === 'Escape') oncancel() }}>
  <div class="modal card">
    <div class="head">
      <div class="ic"><Icon name="sparkles" size={18} /></div>
      <h2>Enhance with AI</h2>
    </div>
    <p>
      To suggest citation types and what to check, Anchor will send <b>portions of this
      document's text</b> to <b>{provider}</b> through your {engine === 'codex' ? 'ChatGPT' : 'Claude'}
      subscription. This is the only time anything leaves your machine.
    </p>
    <div class="warn">
      <Icon name="lock" size={14} />
      <span>Don't enhance material you can't share with {provider} (for example, under a protective order). Anchor will mark this document as AI-used.</span>
    </div>
    <p class="faint">Anchor never stores or transmits your text anywhere else. AI results are shown as suggestions you confirm.</p>
    <div class="actions">
      <button class="btn ghost" onclick={oncancel}>Not now</button>
      <button class="btn primary" onclick={onconfirm}><Icon name="sparkles" size={15} /> Send &amp; enhance</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(10,12,16,0.45); backdrop-filter: blur(3px); display: grid; place-items: center; z-index: 60; padding: 20px; }
  .modal { width: 480px; max-width: 100%; padding: 24px; box-shadow: var(--shadow-3); }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .ic { width: 40px; height: 40px; border-radius: 11px; background: var(--accent-weak); color: var(--accent); display: grid; place-items: center; }
  h2 { font-size: var(--fs-18); font-weight: 640; }
  p { font-size: var(--fs-14); line-height: 1.55; color: var(--text-2); margin-bottom: 12px; }
  p b { color: var(--text); }
  .warn { display: flex; gap: 9px; align-items: flex-start; font-size: var(--fs-13); color: var(--st-progress-fg); background: var(--st-progress-bg); padding: 11px 13px; border-radius: var(--r-2); line-height: 1.45; margin-bottom: 12px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
</style>
