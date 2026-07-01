// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Dependency checks + guided fix steps for the first-run Setup Wizard. Full auto-install
// logic lands in Phase 7; detection is real now.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { detectAgents } from '../ai/detect.js'

const pexec = promisify(execFile)

async function version(bin, args = ['--version']) {
  try { const { stdout } = await pexec(bin, args, { timeout: 5000 }); return stdout.trim().split('\n')[0] } catch { return null }
}

export async function checkDeps() {
  const node = await version(process.execPath, ['--version'])
  const agents = await detectAgents()
  const brew = process.platform === 'darwin' ? await version('brew', ['--version']) : null
  const winget = process.platform === 'win32' ? await version('winget', ['--version']) : null
  return {
    node: { ok: !!node, version: node },
    claude: { ok: agents.claude.present, signedIn: agents.claude.signedIn },
    codex: { ok: agents.codex.present, signedIn: agents.codex.signedIn },
    install: { brew: !!brew, winget: !!winget }
  }
}

// Streams install/sign-in steps. Implemented in Phase 7.
export async function runStep(step) {
  return { ok: false, message: `Guided step "${step}" is implemented in Phase 7.` }
}
