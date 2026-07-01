// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import Ajv from 'ajv'

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true })

const workStateNode = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['todo', 'in-progress', 'done', 'blocked'] },
    substep: { type: ['string', 'null'], enum: [null, 'source-found', 'support-verified', 'draft-written'] },
    note: { type: 'string' },
    resolution: { type: 'string' },
    updatedAt: { type: 'string' },
    seq: { type: 'number' }
  },
  required: ['status', 'updatedAt', 'seq'],
  additionalProperties: false
}

const workStateSchema = {
  type: 'object',
  properties: {
    documentId: { type: 'string' },
    graphVersion: { type: 'number' },
    updatedAt: { type: 'string' },
    nodes: { type: 'object', additionalProperties: workStateNode },
    orphans: { type: 'array' }
  },
  required: ['documentId', 'graphVersion', 'updatedAt', 'nodes'],
  additionalProperties: false
}

const idNode = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }
const claimNode = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    anchor: {
      type: 'object',
      properties: { state: { type: 'string', enum: ['located', 'approximate', 'none'] } },
      required: ['state']
    }
  },
  required: ['id']
}

const graphSchema = {
  type: 'object',
  properties: {
    documentId: { type: 'string' },
    graphVersion: { type: 'number' },
    generatedAt: { type: 'string' },
    generator: { type: 'object' },
    stats: { type: 'object' },
    inputs: { type: 'object' },
    nodes: {
      type: 'object',
      properties: {
        pages: { type: 'array', items: idNode },
        claims: { type: 'array', items: claimNode },
        footnotes: { type: 'array', items: idNode },
        sources: { type: 'array', items: idNode },
        targets: { type: 'array', items: idNode }
      },
      required: ['pages', 'claims', 'footnotes', 'sources', 'targets']
    },
    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['page-claim', 'claim-footnote', 'claim-source', 'footnote-source', 'footnote-target'] },
          from: { type: 'string' },
          to: { type: 'string' }
        },
        required: ['type', 'from', 'to']
      }
    }
  },
  required: ['documentId', 'graphVersion', 'stats', 'nodes', 'edges']
}

const _validateWorkState = ajv.compile(workStateSchema)
const _validateGraph = ajv.compile(graphSchema)

export function validateWorkState(obj) {
  const valid = _validateWorkState(obj)
  return { valid, errors: _validateWorkState.errors || [] }
}

export function validateGraph(obj) {
  const valid = _validateGraph(obj)
  return { valid, errors: _validateGraph.errors || [] }
}
