<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import Icon from './Icon.svelte'
  import { STATUS_META, SUBSTEP_META } from '../lib/workflow.js'
  let { status = 'todo', substep = null, size = 'md' } = $props()
  const meta = $derived(STATUS_META[status] || STATUS_META.todo)
  const sub = $derived(status === 'in-progress' && substep ? SUBSTEP_META[substep] : null)
</script>

<span class="chip st {meta.color}" class:sm={size === 'sm'}>
  <Icon name={meta.icon} size={size === 'sm' ? 12 : 14} />
  <span>{sub || meta.label}</span>
</span>

<style>
  .st { font-weight: 550; }
  .st.sm { padding: 2px 7px; font-size: var(--fs-11); }
  .todo     { background: var(--st-todo-bg);     color: var(--st-todo-fg); }
  .progress { background: var(--st-progress-bg); color: var(--st-progress-fg); }
  .done     { background: var(--st-done-bg);     color: var(--st-done-fg); }
  .blocked  { background: var(--st-blocked-bg);  color: var(--st-blocked-fg); }
</style>
