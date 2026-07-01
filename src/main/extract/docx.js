// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Node file-reading wrapper over the pure DOCX parser (shared with the browser build).
import { readFileSync } from 'node:fs'
import { parseDocxBytes } from './docxParse.js'

/** @param {string} docxPath @returns {Promise<{footnotes:Array, paragraphs:Array, warnings:string[]}>} */
export async function extractDocx(docxPath) {
  let buf
  try { buf = readFileSync(docxPath) } catch (err) { throw new Error(`Could not read DOCX at "${docxPath}": ${err.message}`) }
  return parseDocxBytes(new Uint8Array(buf))
}
