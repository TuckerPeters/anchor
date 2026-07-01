// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
// Browser-only preview of the renderer (uses the in-memory mock API). For fast visual QA
// without launching Electron. Run: npm run web
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'node:path'

const r = (p) => resolve(import.meta.dirname, p)

export default defineConfig({
  root: r('src/renderer'),
  base: './',
  resolve: { alias: { '@shared': r('shared'), '@lib': r('src/renderer/lib') } },
  server: { port: 5178, fs: { allow: [r('.')] } },
  plugins: [svelte()]
})
