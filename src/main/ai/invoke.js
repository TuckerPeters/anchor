// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Thin, bulletproof wrapper around spawning a local subscription-authenticated CLI agent
// (claude or codex) headlessly. NEVER throws and NEVER hangs forever: on any failure —
// missing binary, non-zero exit, a wedged process, an aborted request — it resolves a
// degraded { ok:false, error } result instead. The prompt always goes over stdin (argv is
// capped at ~32KB on Windows), and stdout/stderr are collected unbounded (no maxBuffer trap).
import { spawn } from 'node:child_process'
import { loginShellPath, whichBin } from './detect.js'

const KILL_GRACE_MS = 2000

/**
 * @param {'claude'|'codex'} engine
 * @param {string} prompt
 * @param {{timeoutMs?:number, signal?:AbortSignal, cmd?:string, args?:string[], binPath?:string}} [opts]
 * @returns {Promise<{ok:boolean, text:string, error?:string}>}
 */
export async function invokeAgent(engine, prompt, opts = {}) {
  const { timeoutMs = 60000, signal, cmd: cmdOverride, args: argsOverride, binPath } = opts

  let cmd
  let args
  try {
    if (cmdOverride) {
      cmd = cmdOverride
      args = argsOverride || []
    } else {
      const fallbackBin = engine === 'codex' ? 'codex' : 'claude'
      let resolvedBin = binPath || null
      if (!resolvedBin) {
        try {
          const pathEnv = await loginShellPath()
          resolvedBin = await whichBin(fallbackBin, pathEnv)
        } catch {
          resolvedBin = null
        }
      }
      cmd = resolvedBin || fallbackBin
      args =
        engine === 'codex'
          ? ['exec', '--json', '-']
          : ['-p', '--output-format', 'json', '--allowedTools', '', '--max-turns', '1']
    }
  } catch (e) {
    return { ok: false, text: '', error: 'setup-failed: ' + String(e?.message || e) }
  }

  return new Promise((resolvePromise) => {
    try {
      let settled = false
      let child = null
      let timer = null
      let killTimer = null
      let abortListener = null

      const cleanup = () => {
        if (timer) clearTimeout(timer)
        if (killTimer) clearTimeout(killTimer)
        if (signal && abortListener) {
          try {
            signal.removeEventListener('abort', abortListener)
          } catch {
            // ignore
          }
        }
      }

      const resolve = (result) => {
        if (settled) return
        settled = true
        cleanup()
        resolvePromise(result)
      }

      const killProcessGroup = () => {
        if (!child || child.pid == null) return
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          try {
            child.kill('SIGTERM')
          } catch {
            // ignore
          }
        }
        killTimer = setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch {
            try {
              child.kill('SIGKILL')
            } catch {
              // ignore
            }
          }
        }, KILL_GRACE_MS)
      }

      try {
        child = spawn(cmd, args, { detached: true })
      } catch (e) {
        resolve({ ok: false, text: '', error: 'spawn-failed: ' + String(e?.message || e) })
        return
      }

      const stdoutChunks = []
      const stderrChunks = []
      const collectedText = () => Buffer.concat(stdoutChunks).toString('utf8')

      child.stdout?.on('data', (chunk) => stdoutChunks.push(chunk))
      child.stderr?.on('data', (chunk) => stderrChunks.push(chunk))

      child.on('error', (e) => {
        resolve({ ok: false, text: collectedText(), error: String(e?.message || e) })
      })

      child.on('close', (code) => {
        const text = collectedText()
        if (code === 0) {
          resolve({ ok: true, text })
        } else {
          const errText = Buffer.concat(stderrChunks).toString('utf8')
          resolve({ ok: false, text, error: errText || 'exit ' + code })
        }
      })

      timer = setTimeout(() => {
        killProcessGroup()
        resolve({ ok: false, text: collectedText(), error: 'timeout' })
      }, timeoutMs)

      if (signal) {
        if (signal.aborted) {
          killProcessGroup()
          resolve({ ok: false, text: '', error: 'aborted' })
        } else {
          abortListener = () => {
            killProcessGroup()
            resolve({ ok: false, text: collectedText(), error: 'aborted' })
          }
          signal.addEventListener('abort', abortListener, { once: true })
        }
      }

      try {
        child.stdin?.on('error', () => {
          // Ignore EPIPE-type errors if the child already exited; close/error handlers
          // above are the source of truth for the final result.
        })
        child.stdin?.write(prompt ?? '')
        child.stdin?.end()
      } catch {
        // Writing the prompt failed; the close/error handlers (or the timeout) will
        // still settle this promise.
      }
    } catch (e) {
      resolvePromise({ ok: false, text: '', error: 'invoke-failed: ' + String(e?.message || e) })
    }
  })
}
