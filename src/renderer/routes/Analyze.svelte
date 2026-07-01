<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go } from '../lib/stores.js'
  import Icon from '../components/Icon.svelte'

  let { docId = null, jobId = null } = $props()
  let job = $state(null)
  let doneRouted = false

  const PHASES = [
    { key: 'extract', label: 'Reading your documents' },
    { key: 'graph', label: 'Mapping citations to sources' },
    { key: 'anchor', label: 'Locating each claim on its page' },
    { key: 'enhance', label: 'AI enhancement' },
    { key: 'done', label: 'Ready' }
  ]

  function apply(j) {
    if (!j) return
    job = j
    if (j.status === 'done' && !doneRouted) { doneRouted = true; setTimeout(() => go('review', { docId }), 500) }
  }

  $effect(() => {
    if (!jobId) return
    let unsub = api.jobs.onProgress(jobId, apply)
    const poll = setInterval(async () => { apply(await api.jobs.get(jobId, docId)) }, 700)
    api.jobs.get(jobId, docId).then(apply)
    return () => { unsub?.(); clearInterval(poll) }
  })

  const pct = $derived(job?.progress?.pct ?? 5)
  const phase = $derived(job?.progress?.phase || 'extract')
  const failed = $derived(job?.status === 'failed')
  function phaseState(k) {
    const order = PHASES.map((p) => p.key)
    const cur = order.indexOf(phase)
    const mine = order.indexOf(k)
    if (job?.status === 'done') return 'done'
    if (mine < cur) return 'done'
    if (mine === cur) return 'active'
    return 'pending'
  }
</script>

<div class="wrap">
  {#if failed}
    <div class="fail">
      <div class="fmark"><Icon name="alert" size={26} /></div>
      <h1>Analysis couldn't finish</h1>
      <p class="muted">{job?.error || 'Something went wrong while reading the documents.'}</p>
      <div class="acts">
        <button class="btn" onclick={() => go('import', { docId })}>Back to import</button>
        <button class="btn primary" onclick={() => go('review', { docId })}>Open what was mapped</button>
      </div>
    </div>
  {:else}
    <div class="analyzing">
      <div class="halo"><div class="spinner"></div><Icon name="anchor" size={26} /></div>
      <h1>Mapping your citations</h1>
      <p class="muted">{job?.progress?.message || 'Working through the report…'}</p>

      <div class="bar"><div class="fill" style="width:{pct}%"></div></div>

      <ul class="phases">
        {#each PHASES.filter((p) => p.key !== 'done') as p}
          {@const st = phaseState(p.key)}
          <li class={st}>
            <span class="pmark">
              {#if st === 'done'}<Icon name="check" size={13} />{:else if st === 'active'}<span class="pulse"></span>{:else}<span class="empty"></span>{/if}
            </span>
            <span>{p.label}</span>
          </li>
        {/each}
      </ul>

      {#if job?.warnings?.length || job?.progress?.warning}
        <div class="warn"><Icon name="alert" size={13} /> {job?.progress?.warning || job.warnings.join(', ')}</div>
      {/if}
      <p class="privacy faint"><Icon name="lock" size={12} /> Reading happens entirely on this machine.</p>
    </div>
  {/if}
</div>

<style>
  .wrap { flex: 1; display: grid; place-items: center; padding: 40px; }
  .analyzing { max-width: 460px; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 14px; }
  .halo { position: relative; width: 72px; height: 72px; display: grid; place-items: center; color: var(--accent); }
  .spinner { position: absolute; inset: 0; border-radius: 50%; border: 2.5px solid var(--accent-weak); border-top-color: var(--accent); animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { font-size: var(--fs-21); font-weight: 660; letter-spacing: -0.01em; }
  .bar { width: 100%; height: 6px; border-radius: var(--r-full); background: var(--surface-3); overflow: hidden; margin-top: 6px; }
  .fill { height: 100%; background: var(--accent); border-radius: var(--r-full); transition: width 400ms var(--ease); }
  .phases { list-style: none; padding: 0; margin: 10px 0 0; width: 100%; display: flex; flex-direction: column; gap: 10px; text-align: left; }
  .phases li { display: flex; align-items: center; gap: 11px; font-size: var(--fs-14); color: var(--text-3); }
  .phases li.active { color: var(--text); font-weight: 550; }
  .phases li.done { color: var(--text-2); }
  .pmark { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; flex: none; background: var(--surface-3); color: var(--st-done); }
  .phases li.done .pmark { background: var(--st-done-bg); }
  .phases li.active .pmark { background: var(--accent-weak); }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pp 1s var(--ease) infinite; }
  @keyframes pp { 0%,100% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
  .empty { width: 7px; height: 7px; border-radius: 50%; background: var(--border-strong); }
  .warn { display: flex; align-items: center; gap: 7px; font-size: var(--fs-12); color: var(--st-progress-fg); background: var(--st-progress-bg); padding: 8px 12px; border-radius: var(--r-2); }
  .privacy { display: inline-flex; align-items: center; gap: 5px; font-size: var(--fs-12); margin-top: 6px; }

  .fail { max-width: 440px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .fmark { width: 60px; height: 60px; border-radius: 50%; display: grid; place-items: center; background: var(--st-blocked-bg); color: var(--st-blocked); }
  .fail h1 { font-size: var(--fs-21); }
  .acts { display: flex; gap: 10px; margin-top: 8px; }
</style>
