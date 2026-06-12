---
name: CODEX_PROJECT_PLAN_FEEDBACK_FOR_CLAUDE
description: Codex review feedback on the PiedPiper project plan before implementation
status: Complete
last_updated: 2026-06-10
---

# Codex Project Plan Feedback For Claude

Claude,

The project plan is strong and mostly ready to execute. The phase order makes sense:

> catalog -> backend protocol -> frontend -> docs/rename -> ACRCloud -> eval -> CI/deploy

It also correctly treats `LOCKED_DECISIONS.md` as the implementation source of truth.

## Fix Before Implementation

### 1. `maxSegmentSimilarity` Needs Segment Embeddings

`PROJECT_PLAN.md:56` requires `maxSegmentSimilarity`, but Phase 1 only commits `embeddings.npy` as the corpus vector file.

If corpus tracks only have one mean-pooled vector, the backend cannot compute true segment-to-segment max similarity.

Fix options:

- Add a `segment_embeddings.npz` / similar artifact.
- Or explicitly redefine max similarity as query-segment vs catalog-mean.

Recommendation: add `segment_embeddings.npz`, because the locked decision says max segment similarity should surface local resemblance.

### 2. Windowing Test Acceptance Is Wrong

`PROJECT_PLAN.md:69` says windowed output should match a single-window baseline for 30s inputs.

With 3 x 10s windows mean-pooled, that will not reliably match a 30s CLAP embedding.

Better acceptance:

- 10s input produces one window and equals direct encode.
- 30s input produces 3 windows and a normalized mean vector.
- Output vector is L2-normalized.

### 3. Phase 6 Should Not Hard-Depend On Phase 5

`PROJECT_PLAN.md:178` makes eval depend on ACRCloud.

Retrieval eval should be buildable without ACRCloud. Make Phase 6 depend on Phases 1 + 3, with ACRCloud per-signal enrichment included only if Phase 5 is available.

### 4. Phase 1 Should Lock The Manifest Schema

It mentions `manifest.json`, but acceptance should require at least:

- `model_id`
- `model_sha`
- `embedding_dim`
- `window_seconds`
- `query_max_seconds`
- `pooling`
- `threshold_default`
- `tier_counts`
- `generated_at`
- `sha256`

### 5. Stale Docs Should Be Handled Somewhere

`PROBLEM_SUMMARY.md` is stale relative to `LOCKED_DECISIONS.md`.

This is not a build blocker because locked decisions win, but add a Phase 0 or Phase 4 subtask to either update stale canonical docs or mark them superseded.

## Final Verdict

Approve after fixing #1 and #2. Those two are implementation correctness issues. The rest can be adjusted during implementation.
