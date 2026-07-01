<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import Icon from './Icon.svelte'
  import { STATUS_META, STATUS_ORDER, SUBSTEPS, SUBSTEP_META } from '../lib/workflow.js'
  let { status = 'todo', substep = null, onchange } = $props()

  function pick(s) { onchange(s, s === 'in-progress' ? substep : null) }
  function pickSub(sub) { onchange('in-progress', substep === sub ? null : sub) }
</script>

<div class="picker">
  <div class="seg" role="group" aria-label="Set status">
    {#each STATUS_ORDER as s, i}
      <button class="opt {STATUS_META[s].color}" class:active={status === s} onclick={() => pick(s)}
        title="{STATUS_META[s].label}  ({i + 1})">
        <Icon name={STATUS_META[s].icon} size={14} />
        <span>{STATUS_META[s].label}</span>
      </button>
    {/each}
  </div>
  {#if status === 'in-progress'}
    <div class="subs">
      <span class="lbl faint">Progress</span>
      {#each SUBSTEPS as sub}
        <button class="subchip" class:on={substep === sub} onclick={() => pickSub(sub)}>
          {#if substep === sub}<Icon name="check" size={11} />{/if}{SUBSTEP_META[sub]}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: 10px; }
  .seg { display: inline-flex; gap: 4px; background: var(--surface-3); padding: 4px; border-radius: var(--r-2); align-self: flex-start; flex-wrap: wrap; }
  .opt {
    display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: var(--r-1);
    border: 1px solid transparent; background: transparent; color: var(--text-2); font-size: var(--fs-13); font-weight: 550; cursor: pointer;
    transition: background 100ms var(--ease), color 100ms var(--ease);
  }
  .opt:hover { color: var(--text); background: var(--surface); }
  .opt.active { background: var(--surface); box-shadow: var(--shadow-1); }
  .opt.todo.active { color: var(--st-todo-fg); }
  .opt.progress.active { color: var(--st-progress-fg); box-shadow: inset 0 0 0 1px var(--st-progress), var(--shadow-1); }
  .opt.done.active { color: var(--st-done-fg); box-shadow: inset 0 0 0 1px var(--st-done), var(--shadow-1); }
  .opt.blocked.active { color: var(--st-blocked-fg); box-shadow: inset 0 0 0 1px var(--st-blocked), var(--shadow-1); }

  .subs { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .lbl { font-size: var(--fs-12); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .subchip {
    display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: var(--r-full);
    border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); font-size: var(--fs-12); font-weight: 550; cursor: pointer;
  }
  .subchip:hover { color: var(--text); border-color: var(--text-3); }
  .subchip.on { background: var(--st-progress-bg); color: var(--st-progress-fg); border-color: var(--st-progress); }
</style>
