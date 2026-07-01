<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  import { go } from '../lib/stores.js'
  let { docId = null } = $props()
</script>
<div class="pad"><button class="btn ghost sm" onclick={() => go('review', { docId })}>← Review</button><h2>Handoff — built in Phase 10.</h2></div>
<style>.pad{padding:32px;display:flex;flex-direction:column;gap:16px}</style>
