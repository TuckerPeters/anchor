// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Node file-reading wrapper over the pure register parser (shared with the browser build).
import { readFileSync } from 'node:fs'
import { parseRegisterText } from './registerParse.js'

export { parseRegisterText }

/** @param {string} registerPath @returns {Promise<{sources: Array}>} */
export async function parseRegister(registerPath) {
  let text
  try { text = readFileSync(registerPath, 'utf8') } catch (err) {
    throw new Error(`Could not read register at "${registerPath}": ${err.message}`)
  }
  return parseRegisterText(text)
}
