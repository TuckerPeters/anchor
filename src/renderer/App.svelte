<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { route } from './lib/stores.js'
  import { theme, toggleTheme } from './lib/theme.js'
  import { api } from './lib/api.js'
  import Icon from './components/Icon.svelte'
  import AiChip from './components/AiChip.svelte'
  import Toasts from './components/Toasts.svelte'
  import Documents from './routes/Documents.svelte'
  import Review from './routes/Review.svelte'
  import Import from './routes/Import.svelte'
  import Analyze from './routes/Analyze.svelte'
  import MapView from './routes/Map.svelte'
  import Handoff from './routes/Handoff.svelte'
  import Setup from './routes/Setup.svelte'

  const isMac = api.platform === 'darwin'
</script>

<header class="topbar" class:mac={isMac}>
  <div class="brand">
    <span class="mark"><Icon name="anchor" size={17} /></span>
    <span class="name">Anchor</span>
    <span class="tag">citation review</span>
  </div>
  <div class="spacer"></div>
  <AiChip />
  <button class="icon-btn" aria-label="Toggle theme" title="Toggle light / dark" onclick={toggleTheme}>
    <Icon name={$theme === 'dark' ? 'sun' : 'moon'} size={16} />
  </button>
</header>

<main>
  {#if $route.name === 'documents'}
    <Documents />
  {:else if $route.name === 'review'}
    <Review docId={$route.params.docId} />
  {:else if $route.name === 'import'}
    <Import docId={$route.params.docId} />
  {:else if $route.name === 'analyze'}
    <Analyze docId={$route.params.docId} jobId={$route.params.jobId} />
  {:else if $route.name === 'map'}
    <MapView docId={$route.params.docId} />
  {:else if $route.name === 'handoff'}
    <Handoff docId={$route.params.docId} />
  {:else if $route.name === 'setup'}
    <Setup />
  {/if}
</main>

<Toasts />

<style>
  .topbar {
    height: 46px; flex: 0 0 46px; display: flex; align-items: center; gap: 10px;
    padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--surface);
    -webkit-app-region: drag; user-select: none;
  }
  .topbar.mac { padding-left: 82px; }
  .topbar :where(button, a) { -webkit-app-region: no-drag; }
  .brand { display: flex; align-items: center; gap: 8px; }
  .mark { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px;
    background: var(--accent-weak); color: var(--accent); }
  .name { font-weight: 650; letter-spacing: -0.01em; }
  .tag { color: var(--text-3); font-size: var(--fs-12); font-weight: 500; }
  .spacer { flex: 1; }
  .icon-btn { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2);
    border: 1px solid transparent; background: transparent; color: var(--text-2); cursor: pointer; }
  .icon-btn:hover { background: var(--surface-3); color: var(--text); }
  main { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; }
</style>
