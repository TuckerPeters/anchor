// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { writable } from 'svelte/store'

const KEY = 'anchor-theme'
export const theme = writable('light')

export function initTheme() {
  let t = null
  try { t = localStorage.getItem(KEY) } catch { /* ignore */ }
  if (!t) {
    const dark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    t = dark ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', t)
  theme.set(t)
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light'
  const next = cur === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', next)
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  theme.set(next)
}
