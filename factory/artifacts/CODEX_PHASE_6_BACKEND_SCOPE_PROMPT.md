---
name: CODEX_PHASE_6_BACKEND_SCOPE_PROMPT
description: Codex picks the Phase 6 backend eval-pipeline scope. Backend-only — Claude owns all frontend.
status: Ready
last_updated: 2026-06-12
---

# Phase 6 backend eval-pipeline scope — Codex, pick the path

**For Codex. Read this file end-to-end, then return a 200–300 word recommendation.**

---

## Ownership boundary — strict

Phase 6 splits cleanly between us. **You touch the backend. Claude touches the frontend.** Do not cross.

### Your scope (backend-only)

- `backend/backend/scripts/run_eval.py` — implement
- `backend/backend/scripts/build_golden_set.py` — implement
- `backend/tests/test_run_eval.py` — implement against the existing scaffold; **add** `test_build_golden_set.validate` cases during implementation (the scaffold doesn't yet cover the validator)
- `backend/eval_input/golden_set_input.example.yaml` — already a template; can update if your validator needs tighter examples
- Generated artifacts written by your scripts: `quality-scorer/public/corpus/eval.json` + `quality-scorer/public/eval_audio/*` (these directories are frontend-served *inputs to the page*, but they're produced and owned by your scripts — same as `corpus.json` from Phase 1)

### Not your scope (Claude owns)

- `quality-scorer/src/pages/EvaluationPage.jsx`
- Histogram rendering
- Named FP/FN card UI
- Audio player layout
- Responsive polish

If you find a frontend issue mid-implementation, flag it in your handoff note — do not patch JSX.

---

## Why we're re-scoping

The user reframed the eval page's purpose correctly: **it's about demonstrating eval thinking, not publishing definitive numbers.** For a 5–20 minute warm-intro read by Suno's Head of Engineering, the credibility signal is *"this person knows that any embedding-retrieval / RAG system needs measured evaluation, plus the discipline of running an eval at all."* Real numbers are a bonus; the methodology is load-bearing.

The original `CODEX_PHASE_6.md` (still on disk) assumes 80 Suno generations and an over-spec'd protocol. The user pushed back. Below are three lighter-weight paths.

---

## Important note on data dependency

**Backend implementation is NOT blocked on user data.** You can implement and unit-test all three options now against the existing scaffold tests. What user data gates is the *production of a meaningful `eval.json`*, not the code. The locked output shape is what the frontend reads against; you can verify that shape via the test suite and a smoke run against tiny synthetic inputs.

---

## The three paths — backend deliverables only

### Option Zero — No backend implementation this phase

No `run_eval.py` execution. The page lives as a methodology-only document with no data. Backend stays untouched.

**Your effort:** zero.
**Your deliverables:** none.
**What ships:** Claude updates the frontend; backend is exactly as Phase 5 left it.

### Option A — Methodology + leave-one-out (LOO) over the existing catalog

Implement a leave-one-out eval that runs the catalog against itself: for each of the 160 catalog tracks, hold it out of the index, query the rest, record the rank of any same-track/same-artist match and the top-1 cosine.

Produces real R@1, R@3, MRR + a top-1 cosine distribution. No Suno generation needed.

**Your deliverables:**
- Implement `run_eval.py` with the LOO query-source path (not the Suno-tracks-from-YAML path) — easy to keep the original Suno path behind a flag if you'd rather, but not required.
- Implement `compute_metrics`, `compute_histogram`, `build_named_block` per the existing test contract.
- Implement `build_golden_set.py` for the YAML-based path even though LOO doesn't use it (small file; later opt-in for Option B without re-architecting).
- Make `test_run_eval.py` tests pass; add `test_build_golden_set.validate` cases during implementation.
- A `python -m backend.scripts.run_eval --mode loo` run on the live corpus that writes `quality-scorer/public/corpus/eval.json` in the locked shape.

**Your effort:** half day.
**Honest framing:** the page section header reads *"Retrieval check — leave-one-out over the catalog"*, not *"Eval against AI generations."* Methodology paragraph names the trade-off explicitly.

### Option B — Option A + small Suno set (gated on user data)

Same as Option A plus, when the user delivers ~5 Suno tracks and a tiny `named_examples.yaml` (1 FP + 1 FN with audio paths + "why" notes), your scripts:
- Read `backend/eval_input/golden_set_input.yaml` for the small Suno set
- Run the same metrics pipeline on those queries alongside the LOO numbers (or instead of — your call)
- Copy the named-example audio files to `quality-scorer/public/eval_audio/` and emit the named-examples block into `eval.json`

**Your effort:** half day for the core (same as Option A) + a few hours when the user data lands.
**User effort gate:** ~30 min of Suno generation + 10 min of labeling.

---

## `eval.json` wire shape — unchanged from the original handoff

This is what the frontend reads regardless of which option you pick:

```json
{
  "metrics": {
    "recall_at_1": 0.83,
    "recall_at_3": 0.91,
    "mrr": 0.79,
    "n_queries": 160
  },
  "negatives_histogram": {
    "bins": [0.0, 0.05, ..., 1.0],
    "counts": [0, 1, 2, ...],
    "step": 0.05
  },
  "named_examples": {
    "false_positives": [...],
    "false_negatives": [...]
  },
  "methodology": "...",
  "limitations": "...",
  "manifest": {
    "model_sha": "...",
    "generated_at": "...",
    "n_positives": 160,
    "n_negatives": 0
  }
}
```

If you pick Option A, `negatives_histogram` is computed against the same LOO query set (top-1 cosines for cases where the held-out track was NOT retrieved at rank 1 — these are the "noise floor" for that protocol). `named_examples.{false_positives,false_negatives}` are empty arrays. `methodology` and `limitations` are populated from defaults in `run_eval.py` (or, when present, from `named_examples.yaml`).

If you pick Option B, the named arrays fill up once user data arrives.

---

## Claude's recommendation

**Option A.** Reasoning:

1. The methodology paragraph is the load-bearing piece for the audience; Claude can write that without you or the user.
2. LOO gives real numbers from a real test, honestly framed. The reviewer doesn't penalize the modest scope — they reward the honesty of the methodology paragraph.
3. Framing it *"Retrieval check — leave-one-out over the catalog"* is more defensible than an inflated tiny-Suno eval pretending to be statistically meaningful.
4. If we later want the named-card credibility-mover, Option B slots in as an incremental change without re-architecting the pipeline.
5. Zero user-data-generation work means we never gate ship on Suno credits or weekend availability.

---

## What I'm asking you to do

Return a 200–300 word note with:

1. **Your pick** — Zero, A, or B (or a counter-proposal we missed).
2. **Why** — independent reasoning, not just "I agree with Claude."
3. **Scope edge cases or risks** you'd flag in the chosen path (e.g. LOO reveals an embedding pathology, or `build_golden_set` validation needs cases I'm missing).
4. **Any tightening** to Claude's proposed scope before you'd be willing to implement it.

If you pick A or B, also confirm:
- The LOO script can correctly reuse `similarity.FlatCatalog` with a single track held out without re-encoding — i.e. you can rebuild the catalog matrix with one row removed and slice `seg_ranges` accordingly. No new encoding work.
- The locked `eval.json` shape above is still correct given the LOO framing.

After your note, Claude finalizes scope, rewrites `EvaluationPage.jsx`, and you implement the backend pieces against the locked shape. The two work streams stay separate.
