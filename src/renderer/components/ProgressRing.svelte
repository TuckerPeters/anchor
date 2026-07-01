<!-- Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Apache-2.0. -->
<script>
  let { value = 0, size = 44, stroke = 4, color = 'var(--st-done)', track = 'var(--surface-3)', label = true } = $props()
  const r = $derived((size - stroke) / 2)
  const c = $derived(2 * Math.PI * r)
  const off = $derived(c * (1 - Math.max(0, Math.min(100, value)) / 100))
</script>

<div class="ring" style="width:{size}px;height:{size}px" role="img" aria-label="{value}% resolved">
  <svg width={size} height={size}>
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} stroke-width={stroke} />
    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} stroke-width={stroke}
      stroke-linecap="round" stroke-dasharray={c} stroke-dashoffset={off}
      transform="rotate(-90 {size / 2} {size / 2})" style="transition: stroke-dashoffset 500ms var(--ease)" />
  </svg>
  {#if label}<span class="pct tnum" style="font-size:{Math.round(size / 3.6)}px">{value}<i>%</i></span>{/if}
</div>

<style>
  .ring { position: relative; display: inline-grid; place-items: center; }
  .pct { position: absolute; font-weight: 600; color: var(--text); }
  .pct i { font-style: normal; font-size: 0.7em; color: var(--text-3); margin-left: 0.5px; }
</style>
