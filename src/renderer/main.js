// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.js'

initTheme()

const app = mount(App, { target: document.getElementById('app') })
export default app
