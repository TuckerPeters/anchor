// Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time. Licensed under the Apache License, Version 2.0.
//
// Build pipeline. Deterministic path: extract (pdf + docx + register) -> buildGraph ->
// anchorClaims -> persist. Enhance path: run AI passes writing ai.* overlays.
// NOTE: extraction + graph land in Phase 2/3, AI in Phase 4. This is the seam they plug into.
export async function runPipeline(root, id, opts, emit) {
  emit({ progress: { phase: 'extract', pct: 10, message: 'Reading your documents…' } })
  // Phase 2/3/4 implement here.
}
