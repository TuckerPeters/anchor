// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { writable } from 'svelte/store'

/** Simple in-app router. */
export const route = writable({ name: 'documents', params: {} })
export function go(name, params = {}) { route.set({ name, params }) }

/** Toast / undo notifications. */
export const toasts = writable([])
let tid = 0
export function toast(msg, opts = {}) {
  const id = ++tid
  toasts.update((t) => [...t, { id, msg, ...opts }])
  if (!opts.sticky) setTimeout(() => dismissToast(id), opts.duration || 4200)
  return id
}
export function dismissToast(id) {
  toasts.update((t) => t.filter((x) => x.id !== id))
}
