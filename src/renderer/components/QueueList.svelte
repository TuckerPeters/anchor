<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import Icon from './Icon.svelte'
  import StatusChip from './StatusChip.svelte'
  import { QUEUE_KINDS } from '../lib/workflow.js'

  let { queue = [], selectedId = null, onselect } = $props()

  const KIND_SHORT = {
    'missing-source': 'Missing source', 'needs-pincite': 'Pincite',
    'cross-reference': 'Cross-ref', 'reused-source': 'Reused', 'support': 'Support'
  }
  const KIND_ICON = {
    'missing-source': 'search', 'needs-pincite': 'file', 'cross-reference': 'corner',
    'reused-source': 'reuse', 'support': 'link'
  }

  let filter = $state('all')
  let showResolved = $state(false)

  const isOpen = (it) => it.status === 'todo' || it.status === 'in-progress'
  const open = $derived(queue.filter(isOpen))
  const blocked = $derived(queue.filter((it) => it.status === 'blocked'))
  const resolved = $derived(queue.filter((it) => it.status === 'done'))

  const kindsPresent = $derived(QUEUE_KINDS.filter((k) => queue.some((it) => it.kind === k.key)))
  function countOpen(kindKey) { return open.filter((it) => kindKey === 'all' || it.kind === kindKey).length }

  const visibleOpen = $derived(
    (filter === 'all' ? open : open.filter((it) => it.kind === filter))
  )
  const visibleBlocked = $derived(filter === 'all' ? blocked : blocked.filter((it) => it.kind === filter))
  const visibleResolved = $derived(filter === 'all' ? resolved : resolved.filter((it) => it.kind === filter))

  const snippet = (it) => (it.claims[0]?.text || it.footnote.rawText || '').slice(0, 96)
</script>

<div class="q">
  <div class="q-head">
    <div class="count">
      <span class="big tnum">{open.length}</span>
      <span class="lbl">to resolve</span>
    </div>
    {#if blocked.length}<span class="bl-pill"><Icon name="x" size={11} /> {blocked.length} blocked</span>{/if}
    {#if resolved.length}<span class="dn-pill"><Icon name="check" size={11} /> {resolved.length} done</span>{/if}
  </div>

  <div class="filters">
    <button class="fchip" class:on={filter === 'all'} onclick={() => (filter = 'all')}>All <b class="tnum">{countOpen('all')}</b></button>
    {#each kindsPresent as k}
      <button class="fchip" class:on={filter === k.key} onclick={() => (filter = k.key)} title={k.hint}>
        {KIND_SHORT[k.key]} <b class="tnum">{countOpen(k.key)}</b>
      </button>
    {/each}
  </div>

  <div class="list">
    {#each visibleOpen as it (it.id)}
      <button class="row" class:sel={selectedId === it.id} onclick={() => onselect(it.id)}>
        <span class="fn tnum">{it.footnote.number}</span>
        <span class="body">
          <span class="kind"><Icon name={KIND_ICON[it.kind]} size={11} /> {KIND_SHORT[it.kind]}</span>
          <span class="snip">{snippet(it)}</span>
        </span>
        {#if it.status === 'in-progress'}<StatusChip status={it.status} substep={it.substep} size="sm" />{/if}
        <Icon name="chevronRight" size={15} />
      </button>
    {/each}

    {#if visibleOpen.length === 0}
      <div class="clear">
        <div class="clear-mark"><Icon name="check" size={20} /></div>
        <p>{filter === 'all' ? 'Everything here is resolved.' : 'Nothing left in this group.'}</p>
      </div>
    {/if}

    {#if visibleBlocked.length}
      <div class="divider">Blocked</div>
      {#each visibleBlocked as it (it.id)}
        <button class="row blocked" class:sel={selectedId === it.id} onclick={() => onselect(it.id)}>
          <span class="fn tnum bl">{it.footnote.number}</span>
          <span class="body"><span class="kind">{KIND_SHORT[it.kind]}</span><span class="snip">{snippet(it)}</span></span>
          <StatusChip status="blocked" size="sm" />
        </button>
      {/each}
    {/if}

    {#if visibleResolved.length}
      <button class="divider tog" onclick={() => (showResolved = !showResolved)}>
        Resolved · {visibleResolved.length} <Icon name={showResolved ? 'chevronRight' : 'chevronRight'} size={12} />
      </button>
      {#if showResolved}
        {#each visibleResolved as it (it.id)}
          <button class="row done" class:sel={selectedId === it.id} onclick={() => onselect(it.id)}>
            <span class="fn tnum dn">{it.footnote.number}</span>
            <span class="body"><span class="snip">{snippet(it)}</span></span>
            <StatusChip status="done" size="sm" />
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</div>

<style>
  .q { display: flex; flex-direction: column; height: 100%; min-height: 0; }
  .q-head { display: flex; align-items: baseline; gap: 10px; padding: 4px 4px 12px; }
  .count { display: flex; align-items: baseline; gap: 7px; }
  .big { font-size: var(--fs-26); font-weight: 700; letter-spacing: -0.02em; color: var(--text); }
  .lbl { font-size: var(--fs-13); color: var(--text-2); }
  .bl-pill, .dn-pill { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-11); font-weight: 600; padding: 2px 8px; border-radius: var(--r-full); }
  .bl-pill { color: var(--st-blocked-fg); background: var(--st-blocked-bg); }
  .dn-pill { color: var(--st-done-fg); background: var(--st-done-bg); }

  .filters { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 2px 12px; }
  .fchip { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: var(--r-full);
    border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font-size: var(--fs-12); font-weight: 550; cursor: pointer; }
  .fchip:hover { color: var(--text); border-color: var(--border-strong); }
  .fchip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
  .fchip b { opacity: 0.75; font-weight: 700; }

  .list { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 2px; }
  .row {
    display: flex; align-items: center; gap: 11px; width: 100%; text-align: left; cursor: pointer;
    padding: 11px 11px; border-radius: var(--r-2); border: 1px solid transparent; background: transparent; color: inherit;
    transition: background 90ms var(--ease);
  }
  .row:hover { background: var(--surface-2); }
  .row.sel { background: var(--accent-weak); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
  .fn { flex: none; width: 26px; height: 26px; display: grid; place-items: center; border-radius: var(--r-1);
    background: var(--surface-3); color: var(--text-2); font-size: var(--fs-12); font-weight: 650; }
  .fn.bl { background: var(--st-blocked-bg); color: var(--st-blocked-fg); }
  .fn.dn { background: var(--st-done-bg); color: var(--st-done-fg); }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .kind { display: inline-flex; align-items: center; gap: 4px; font-size: var(--fs-11); font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.03em; }
  .snip { font-size: var(--fs-13); color: var(--text); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .row.done .snip { color: var(--text-3); }
  .row :global(svg:last-child) { color: var(--text-3); flex: none; }

  .divider { font-size: var(--fs-11); text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-3); font-weight: 650; padding: 12px 8px 6px; border: none; background: none; text-align: left; }
  .divider.tog { cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }

  .clear { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 20px; text-align: center; }
  .clear-mark { width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; background: var(--st-done-bg); color: var(--st-done); }
  .clear p { color: var(--text-2); font-size: var(--fs-14); }
</style>
