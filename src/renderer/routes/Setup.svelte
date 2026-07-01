<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { api } from '../lib/api.js'
  import { go, toast } from '../lib/stores.js'
  import Icon from '../components/Icon.svelte'

  let deps = $state(null)
  let checking = $state(true)
  let testing = $state({ claude: false, codex: false })
  let expanded = $state(null)

  const isMac = api.platform === 'darwin'

  const STEPS = {
    claude: {
      name: 'Claude Code', sub: 'Uses your Claude Pro or Max subscription',
      install: isMac ? 'curl -fsSL https://claude.ai/install.sh | bash' : 'irm https://claude.ai/install.ps1 | iex',
      signin: 'claude', signinNote: 'Then follow the browser sign-in with your Claude account.'
    },
    codex: {
      name: 'Codex', sub: 'Uses your ChatGPT Plus or Pro subscription',
      install: isMac ? 'brew install codex' : 'winget install OpenAI.Codex',
      signin: 'codex login', signinNote: 'Choose "Sign in with ChatGPT".'
    }
  }

  async function check() { checking = true; deps = await api.setup.checkDeps(); checking = false }
  $effect(() => { check() })

  async function test(engine) {
    testing[engine] = true
    const r = await api.ai.test(engine)
    testing[engine] = false
    toast(r.message, { tone: r.ok ? undefined : 'blocked' })
    if (r.ok) check()
  }
  function copy(text) { navigator.clipboard?.writeText(text); toast('Copied') }

  function statusOf(engine) {
    if (!deps) return 'unknown'
    const d = deps[engine]
    if (!d?.ok) return 'missing'
    if (!d?.signedIn) return 'installed'
    return 'connected'
  }
</script>

<div class="wrap">
  <header class="hd">
    <button class="back" onclick={() => go('documents')} aria-label="Back"><Icon name="arrowLeft" size={16} /></button>
    <div><h1>Connect AI <span class="opt">optional</span></h1></div>
  </header>

  <div class="intro card">
    <div class="intro-icon"><Icon name="sparkles" size={20} /></div>
    <div>
      <h2>Anchor works fully without AI.</h2>
      <p class="muted">Everything you've seen — mapping citations, the review queue, the highlighted pages, the handoff — runs on your machine with no AI at all. That's <b>Standard review</b>. Connecting AI just adds suggestions on top, using a subscription you may already have.</p>
    </div>
  </div>

  <div class="agents">
    {#each ['claude', 'codex'] as engine}
      {@const s = statusOf(engine)}
      {@const meta = STEPS[engine]}
      <div class="agent card">
        <div class="agent-head">
          <div class="ah-main">
            <div class="ah-title">{meta.name}
              {#if s === 'connected'}<span class="pill on"><Icon name="check" size={11} /> Connected</span>
              {:else if s === 'installed'}<span class="pill mid">Installed · not signed in</span>
              {:else}<span class="pill off">Not set up</span>{/if}
            </div>
            <div class="ah-sub muted">{meta.sub}</div>
          </div>
          <div class="ah-acts">
            {#if s === 'connected'}
              <button class="btn sm" disabled={testing[engine]} onclick={() => test(engine)}>{testing[engine] ? 'Testing…' : 'Test'}</button>
            {:else}
              <button class="btn sm" onclick={() => (expanded = expanded === engine ? null : engine)}>{expanded === engine ? 'Hide steps' : 'Set up'}</button>
            {/if}
          </div>
        </div>

        {#if expanded === engine && s !== 'connected'}
          <div class="steps">
            {#if s === 'missing'}
              <div class="step">
                <span class="sn">1</span>
                <div>
                  <div class="st-t">Install {meta.name}</div>
                  <div class="cmd"><code class="mono">{meta.install}</code><button class="cp" onclick={() => copy(meta.install)} aria-label="Copy"><Icon name="link" size={13} /></button></div>
                  <p class="st-n faint">Paste this once into Terminal{isMac ? '' : ' / PowerShell'}. The installer bundled with Anchor can do this for you too.</p>
                </div>
              </div>
            {/if}
            <div class="step">
              <span class="sn">{s === 'missing' ? 2 : 1}</span>
              <div>
                <div class="st-t">Sign in</div>
                <div class="cmd"><code class="mono">{meta.signin}</code><button class="cp" onclick={() => copy(meta.signin)} aria-label="Copy"><Icon name="link" size={13} /></button></div>
                <p class="st-n faint">{meta.signinNote}</p>
              </div>
            </div>
            <div class="step-foot">
              <button class="btn sm ghost" onclick={check}><Icon name="refresh" size={13} /> Re-check</button>
              <button class="btn sm" disabled={testing[engine]} onclick={() => test(engine)}>{testing[engine] ? 'Testing…' : 'Test connection'}</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="foot">
    <p class="faint">No subscription? That's fine — Standard review does the whole job.</p>
    <button class="btn primary" onclick={() => go('documents')}>Use Anchor</button>
  </div>
</div>

<style>
  .wrap { max-width: 680px; width: 100%; margin: 0 auto; padding: 34px 30px 60px; }
  .hd { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
  .back { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--r-2); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); cursor: pointer; }
  .back:hover { background: var(--surface-2); color: var(--text); }
  h1 { font-size: var(--fs-26); font-weight: 680; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
  .opt { font-size: var(--fs-12); font-weight: 600; color: var(--text-3); border: 1px solid var(--border); padding: 2px 9px; border-radius: var(--r-full); }

  .intro { display: flex; gap: 16px; padding: 20px; margin-bottom: 20px; }
  .intro-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--accent-weak); color: var(--accent); display: grid; place-items: center; flex: none; }
  .intro h2 { font-size: var(--fs-16); font-weight: 640; }
  .intro p { margin-top: 5px; font-size: var(--fs-13); line-height: 1.55; }

  .agents { display: flex; flex-direction: column; gap: 12px; }
  .agent { padding: 16px 18px; }
  .agent-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ah-title { font-size: var(--fs-15); font-weight: 620; display: flex; align-items: center; gap: 10px; }
  .ah-sub { font-size: var(--fs-12); margin-top: 2px; }
  .pill { font-size: var(--fs-11); font-weight: 600; padding: 2px 9px; border-radius: var(--r-full); }
  .pill.on { color: var(--st-done-fg); background: var(--st-done-bg); display: inline-flex; align-items: center; gap: 4px; }
  .pill.mid { color: var(--st-progress-fg); background: var(--st-progress-bg); }
  .pill.off { color: var(--text-3); background: var(--surface-3); }

  .steps { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; display: flex; flex-direction: column; gap: 14px; }
  .step { display: flex; gap: 12px; }
  .sn { flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent-weak); color: var(--accent); display: grid; place-items: center; font-size: var(--fs-12); font-weight: 700; }
  .st-t { font-size: var(--fs-14); font-weight: 550; }
  .cmd { display: flex; align-items: center; gap: 8px; margin-top: 6px; background: var(--surface-3); border-radius: var(--r-2); padding: 8px 10px; }
  .cmd code { font-size: var(--fs-13); color: var(--text); flex: 1; word-break: break-all; }
  .cp { border: none; background: transparent; color: var(--text-3); cursor: pointer; padding: 3px; border-radius: var(--r-1); }
  .cp:hover { color: var(--text); background: var(--surface); }
  .st-n { font-size: var(--fs-12); margin-top: 5px; }
  .step-foot { display: flex; gap: 8px; justify-content: flex-end; }

  .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 24px; }
  .foot p { font-size: var(--fs-13); }
</style>
