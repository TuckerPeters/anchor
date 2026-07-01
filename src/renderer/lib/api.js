// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Thin wrapper over the backend. In the desktop app this is the preload `window.anchor`.
// In a plain browser (the hosted web version) it's a full IndexedDB-backed backend that
// runs the deterministic pipeline client-side — nothing is uploaded. AI needs the desktop app.
import { createWebBackend } from './webBackend.js'

const real = typeof window !== 'undefined' && window.anchor
export const api = real || createWebBackend()
export const isWeb = !real
export const isMock = isWeb
