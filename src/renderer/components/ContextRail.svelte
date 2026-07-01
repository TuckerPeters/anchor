<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import Icon from './Icon.svelte'
  let { item = null, graph = null } = $props()

  const CLASS_LABEL = {
    paper: 'Paper', docs: 'Documentation', repo: 'Code repository', web: 'Web page',
    case: 'Case / docket', screenshot: 'Screenshot', 'cross-reference': 'Cross-reference', missing: 'Unidentified', note: 'Note'
  }

  const source = $derived(item?.source || null)
  const claimById = $derived(graph ? Object.fromEntries(graph.nodes.claims.map((c) => [c.id, c])) : {})
  const pageOf = $derived((cid) => claimById[cid]?.pageId?.replace('p', '') ?? '?')
  const supportedClaims = $derived(source ? source.claimIds.map((id) => claimById[id]).filter(Boolean) : [])
</script>

<aside class="rail">
  <h3 class="rail-title">Context</h3>

  {#if source}
    <div class="block">
      <div class="src-head">
        <span class="cls">{CLASS_LABEL[source.class] || source.class}</span>
      </div>
      <p class="src-title reading">{source.title || 'Untitled source'}</p>
      {#if source.key}<p class="src-key mono">{source.key}</p>{/if}
      {#each source.url as u}
        <div class="url"><Icon name="link" size={12} /> <span class="mono">{u}</span></div>
      {/each}
      {#if source.localCandidate}<div class="url"><Icon name="file" size={12} /> <span class="mono">{source.localCandidate}</span></div>{/if}
      {#if source.auditNote}<p class="audit"><Icon name="alert" size={12} /> {source.auditNote}</p>{/if}
    </div>

    {#if supportedClaims.length > 1}
      <div class="reuse">
        <Icon name="reuse" size={14} />
        <span>Supports <b>{supportedClaims.length} claims</b> — resolving this source clears them together.</span>
      </div>
    {/if}

    <div class="block">
      <h4 class="lbl">{supportedClaims.length > 1 ? 'Where it\'s cited' : 'Supports this claim'}</h4>
      {#each supportedClaims as c (c.id)}
        <div class="claimref">
          <span class="pg tnum">p{pageOf(c.id)}</span>
          <span class="reading">{c.text}</span>
        </div>
      {/each}
    </div>
  {:else if item}
    <div class="block">
      <h4 class="lbl">Footnote {item.footnote.number}</h4>
      <p class="raw reading">{item.footnote.rawText}</p>
    </div>
  {/if}

  {#if item?.targets?.length}
    <div class="block">
      <h4 class="lbl">Candidate internal target{item.targets.length > 1 ? 's' : ''}</h4>
      {#each item.targets as t (t.id)}
        <div class="target"><Icon name="corner" size={13} /> <span>{t.label}</span></div>
      {/each}
      <p class="hint faint">Confirm this is the section the footnote points to.</p>
    </div>
  {/if}
</aside>

<style>
  .rail { display: flex; flex-direction: column; gap: 16px; padding: 4px; height: 100%; overflow-y: auto; }
  .rail-title { font-size: var(--fs-12); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); font-weight: 650; }
  .block { display: flex; flex-direction: column; gap: 7px; }
  .lbl { font-size: var(--fs-11); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-3); font-weight: 650; }
  .src-head { display: flex; }
  .cls { font-size: var(--fs-11); font-weight: 650; color: var(--accent); background: var(--accent-weak); padding: 2px 8px; border-radius: var(--r-full); }
  .src-title { font-size: var(--fs-15); line-height: 1.4; color: var(--text); }
  .src-key { font-size: var(--fs-12); color: var(--text-3); }
  .url { display: flex; align-items: center; gap: 6px; font-size: var(--fs-12); color: var(--text-2); word-break: break-all; }
  .audit { display: flex; gap: 6px; font-size: var(--fs-12); color: var(--st-progress-fg); background: var(--st-progress-bg); padding: 8px 10px; border-radius: var(--r-2); line-height: 1.4; }
  .reuse { display: flex; gap: 8px; align-items: flex-start; font-size: var(--fs-12); color: var(--text-2); background: var(--surface-2); border: 1px solid var(--border); padding: 10px 12px; border-radius: var(--r-2); line-height: 1.45; }
  .reuse b { color: var(--text); }
  .claimref { display: flex; gap: 9px; padding: 8px 0; border-top: 1px solid var(--border); font-size: var(--fs-13); line-height: 1.45; }
  .claimref:first-of-type { border-top: none; }
  .pg { flex: none; font-size: var(--fs-11); font-weight: 650; color: var(--text-3); background: var(--surface-3); padding: 2px 6px; border-radius: var(--r-1); height: fit-content; }
  .raw { font-size: var(--fs-13); line-height: 1.55; color: var(--text); }
  .target { display: flex; align-items: center; gap: 7px; font-size: var(--fs-13); color: var(--text); }
  .hint { font-size: var(--fs-12); }
</style>
