// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
import { join } from 'node:path'

export const docsRoot = (root) => join(root, 'documents')
export const docDir = (root, id) => join(docsRoot(root), id)
export const docFile = (root, id) => join(docDir(root, id), 'document.json')
export const graphFile = (root, id) => join(docDir(root, id), 'graph.json')
export const workStateFile = (root, id) => join(docDir(root, id), 'work-state.json')
export const uploadsDir = (root, id) => join(docDir(root, id), 'uploads')
export const jobsDir = (root, id) => join(docDir(root, id), 'jobs')
