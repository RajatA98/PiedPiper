# Codex prompt — Sanity-check before PiedPiper moves from Presearch → Decide

> Copy everything below the line into Codex. Codex needs access to `factory/artifacts/PRESEARCH.md` and `factory/artifacts/PRD.md`.

---

PiedPiper's PRESEARCH has been simplified following a product UX decision on 2026-06-09:

- The verdict chip (`unique` / `related` / `similar` / `near-duplicate`) was **removed**.
- The UI now just ranks **top 3 by similarity %, descending**, with a `"Completely unique — no close matches in our catalog"` headline when the top score falls below the threshold.
- The eval is now **retrieval-only**: Recall@1, Recall@3, MRR + named false-positive + false-negative examples.
- **Only one threshold remains** — the "Completely unique" cutoff (provisional `0.70`).
- ACRCloud's two signals (Cover Song ID + AI Music Detector) now appear as **independent rows** on the ReportCard, not as a composite verdict.

## Context

Claude has updated `PRESEARCH.md` and `PRD.md` to reflect the above. Eight Q sections were left untouched because both passes had already converged on the same recommendation:

- Q3 — catalog freshness (static commit-time artifact, single rebuild CLI)
- Q5 — failure UI (plain-language copy + small technical code)
- Q6 — example chips (hybrid: precomputed + rerun-live button)
- Q8 — embedding model (LAION-CLAP music 512-d, pin SHA)
- Q9 — vector search (NumPy cosine sweep)
- Q11 — backend hosting (HF Space CPU Basic + uptime ping)
- Q12 — frontend hosting (Vercel)
- Q13 — CI/build (commit artifacts + GitHub Actions eval-diff check)

Claude's recommendation: **approve all eight as-is, move to the Decide phase.**

## Your job

A focused sanity-check pass — NOT a fresh research pass.

1. Read the updated `PRESEARCH.md` and `PRD.md`. Identify any Q section, "Things to flag" item, or decision that is now **inconsistent with the post-chip simplification** and that Claude missed in the edit pass.

2. Specifically check:
   - **Q5 failure UI copy** — does it need a new copy variant for the "Completely unique" empty state, or any other UX implication of the simplification?
   - **Things to flag** — any other items besides #5 that assume the old chip world?
   - **Q4 eval / Q1 threshold** — do the updated recommendations actually fit together? (e.g., does the score-distribution histogram on negatives play the role the threshold calibration needs?)
   - **PRD's Flow 3 (eval page)** — anything still referencing per-verdict metrics?
   - **Hidden inconsistencies** anywhere else (file links, citations, decision references).

3. Push back if Claude's "approve all and move to Decide" recommendation misses something material.

## Output

A short note (under 300 words) with:

- **Things to update before Decide** (bulleted list with file:section references, or "none")
- **Things you'd flag for the Decide phase to address** (bulleted list, or "none")
- **Final verdict:** `approve and move to Decide` or `update X first, then approve`

Don't pad. Don't re-research the resolved Qs. This is a tightening pass on the simplification, not a re-litigation of earlier decisions.
