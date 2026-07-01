// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'node:path'

const r = (p) => resolve(import.meta.dirname, p)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: { input: { index: r('src/main/index.js') } }
    },
    resolve: {
      alias: { '@shared': r('shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { index: r('src/preload/index.js') },
        output: { format: 'cjs', entryFileNames: '[name].cjs' }
      }
    }
  },
  renderer: {
    root: r('src/renderer'),
    server: { fs: { allow: [r('.')] } },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: { index: r('src/renderer/index.html') } }
    },
    resolve: {
      alias: { '@shared': r('shared'), '@lib': r('src/renderer/lib') }
    },
    plugins: [svelte()]
  }
})
