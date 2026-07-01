// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Anchor — FROZEN data contracts (JSDoc typedefs, documentation only; no runtime).
// Every subsystem depends on these shapes. Do not drift without updating the plan.

/**
 * @typedef {'todo'|'in-progress'|'done'|'blocked'} Status
 * @typedef {null|'source-found'|'support-verified'|'draft-written'} Substep
 * @typedef {'located'|'approximate'|'none'} AnchorState
 * @typedef {'paper'|'docs'|'repo'|'web'|'case'|'screenshot'|'cross-reference'|'missing'|'note'} SourceClass
 */

/**
 * @typedef {Object} Document
 * @property {string} id
 * @property {string} title
 * @property {'new'|'extracting'|'ready'|'failed'} status
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} graphVersion
 * @property {{docx:?string, pdf:?string, register:?string}} inputs
 * @property {Object} stats
 * @property {{used:boolean, engine:?('claude'|'codex'), lastUsedAt:?string}} ai  egress marker
 * @property {{textLayer:boolean, scanned:boolean, singleFile:boolean}} flags
 * @property {boolean} isDemo
 */

/**
 * @typedef {Object} Bbox  normalized 0-1, TOP-LEFT origin (display space)
 * @property {number} x @property {number} y @property {number} w @property {number} h
 */

/**
 * @typedef {Object} ClaimNode
 * @property {string} id            c-<paraId>
 * @property {string} paraId
 * @property {?string} pageId       assigned by anchoring
 * @property {string} text
 * @property {string[]} footnoteRefs
 * @property {string[]} sourceIds
 * @property {{state:AnchorState, score:number, bbox?:Bbox}} anchor
 */

/**
 * @typedef {Object} FootnoteNode
 * @property {string} id            f<displayNumber>
 * @property {number} number
 * @property {'support'|'cross-reference'|'note'} role
 * @property {string} rawText
 * @property {string[]} sourceIds
 * @property {string[]} candidateTargetIds
 * @property {string[]} claimIds
 * @property {SourceClass} class    deterministic (source of truth)
 * @property {string} citationNeed  deterministic
 * @property {?{class?:string, citationNeed?:string, candidateTargetIds?:string[], confidence:number, engine:string}} ai  suggestion overlay only
 */

/**
 * @typedef {Object} SourceNode
 * @property {string} id            s-<slug(key)>
 * @property {string} key
 * @property {SourceClass} class
 * @property {string} title
 * @property {string[]} url
 * @property {string} localCandidate
 * @property {string} auditNote
 * @property {string} citationNeed
 * @property {string[]} claimIds
 * @property {string[]} footnoteIds
 * @property {?{class?:string, citationNeed?:string, confidence:number, engine:string}} ai
 */

/**
 * @typedef {Object} Graph
 * @property {string} documentId
 * @property {string} generatedAt
 * @property {number} graphVersion
 * @property {{version:string, ai:?{engine:string, model:string}}} generator
 * @property {{pages:number,claims:number,footnotes:number,sources:number,targets:number,edges:number}} stats
 * @property {{docx:?string,pdf:?string,register:?string,textLayer:boolean,warnings:string[]}} inputs
 * @property {{pages:Array,claims:ClaimNode[],footnotes:FootnoteNode[],sources:SourceNode[],targets:Array}} nodes
 * @property {Array<{id:string,type:string,from:string,to:string,meta?:Object}>} edges
 */

/**
 * @typedef {Object} WorkStateNode
 * @property {Status} status
 * @property {Substep} substep
 * @property {string} note
 * @property {string} resolution
 * @property {string} updatedAt
 * @property {number} seq   monotonic per-node client sequence; merge tiebreak
 */

/**
 * @typedef {Object} WorkState
 * @property {string} documentId
 * @property {number} graphVersion
 * @property {string} updatedAt
 * @property {Object.<string, WorkStateNode>} nodes
 * @property {Array<{nodeId:string, prev:Object, reason:string}>} orphans
 */

/**
 * Raw extractor interface (Phase 2 -> Phase 3):
 * @typedef {Object} PageData    { number, width, height, items:[{str,x,y,w,h}], text }
 * @typedef {Object} FootnoteRaw { wid, number, rawText, role }
 * @typedef {Object} ParagraphRaw{ paraId, index, text, footnoteRefs:number[], style }
 * @typedef {Object} SourceRaw   { key, class, title, url:string[], localCandidate, auditNote, citationNeed }
 */

export {}
