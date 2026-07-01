// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Detect locally-installed, subscription-authenticated CLI agents. A GUI-launched app
// inherits a minimal PATH, so we resolve the real PATH via the login shell.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const pexec = promisify(execFile)
const isWin = process.platform === 'win32'

let cachedPath = null
export async function loginShellPath() {
  if (cachedPath) return cachedPath
  if (isWin) return (cachedPath = process.env.PATH || '')
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    const { stdout } = await pexec(shell, ['-lic', 'command -v true >/dev/null 2>&1; printf %s "$PATH"'], { timeout: 5000 })
    cachedPath = (stdout || '').trim() || process.env.PATH || ''
  } catch {
    cachedPath = process.env.PATH || ''
  }
  return cachedPath
}

export async function whichBin(bin, pathEnv) {
  const dirs = (pathEnv || '').split(isWin ? ';' : ':').filter(Boolean)
  const exts = isWin ? ['.cmd', '.exe', '.bat', ''] : ['']
  for (const d of dirs) {
    for (const e of exts) {
      const p = join(d, bin + e)
      if (existsSync(p)) return p
    }
  }
  return null
}

async function claudeSignedIn() {
  // Presence heuristic only — never spend quota at detect time. A real call happens
  // behind the explicit "Test connection" button.
  return existsSync(join(homedir(), '.claude', '.credentials.json'))
}

async function codexSignedIn(bin) {
  try {
    const { stdout } = await pexec(bin, ['login', 'status'], { timeout: 6000 })
    return /logged in|signed in|authenticated|chatgpt/i.test(stdout)
  } catch {
    return false
  }
}

export async function detectAgents() {
  const pathEnv = await loginShellPath()
  const claudeBin = await whichBin('claude', pathEnv)
  const codexBin = await whichBin('codex', pathEnv)
  return {
    claude: { present: !!claudeBin, path: claudeBin, signedIn: claudeBin ? await claudeSignedIn() : false },
    codex: { present: !!codexBin, path: codexBin, signedIn: codexBin ? await codexSignedIn(codexBin) : false }
  }
}

// Real, quota-spending probe — only from the Setup "Test connection" button. Fleshed out in Phase 4.
export async function testAgent(engine) {
  const { invokeAgent } = await import('./invoke.js')
  const { extractJson } = await import('./jsonExtract.js')
  try {
    const res = await invokeAgent(engine, 'Reply with only this JSON: {"ok":true}. No prose.', { timeoutMs: 30000 })
    if (!res.ok) return { ok: false, message: res.error || 'No response from the AI.' }
    const parsed = extractJson(engine, res.text)
    if (parsed && parsed.ok) return { ok: true, message: 'Connected. Your AI responded correctly.' }
    return { ok: false, message: 'The AI responded but not in the expected format.' }
  } catch (e) {
    return { ok: false, message: String(e?.message || e) }
  }
}
