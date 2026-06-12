---
name: CODEX_PHASE_6
description: Phase 6 implementation handoff for Codex — LOCKED to Option A (leave-one-out over the existing catalog). Backend-only; Claude owns the eval page.
status: Ready
last_updated: 2026-06-12
---

# Phase 6 implementation — Leave-one-out eval pipeline

**For Codex. Read this file end-to-end, then implement. This is the locked Option A scope per the decision tracked in `CODEX_PHASE_6_BACKEND_SCOPE_PROMPT.md`.**

---

## Ownership boundary — strict

**You touch the backend. Claude touches the frontend. Do not cross.**

### Your scope (backend-only)

- `backend/backend/scripts/run_eval.py` — implement against the existing scaffold
- `backend/backend/scripts/build_golden_set.py` — implement against the existing scaffold (latent for Option B; small, do it now)
- `backend/tests/test_run_eval.py` — implement test bodies + **add `test_build_golden_set.validate` cases** (the scaffold doesn't yet cover the validator)
- Generated artifact: `quality-scorer/public/corpus/eval.json` — produced by your `run_eval.py` run; locked wire shape below

### Not your scope (Claude owns)

- `quality-scorer/src/pages/EvaluationPage.jsx`
- Histogram rendering · named-example card UI · audio player layout · responsive polish

If you find a frontend issue mid-implementation, flag it in your handoff note — do not patch JSX.

---

## What this phase produces

A **leave-one-out (LOO) retrieval eval** over the live 160-track catalog. For each track, hold it out, query the remaining 159, record where (if at all) the held-out track surfaces in the top-K results and capture the top-1 cosine. Compute:

- **`Recall@1`, `Recall@3`, `MRR`** — over all 160 LOO queries
- **Top-1 cosine histogram** — distribution of top-1 cosines across all LOO queries; lets the page show where the noise floor sits

The page's section header reads *"Retrieval check — leave-one-out over the catalog"*. This is NOT framed as an end-to-end AI-soundalike eval; the methodology paragraph names the trade-off explicitly. Honest framing wins.

**Implementation is not blocked on user data.** You can implement and test the full pipeline today against synthetic test inputs + the live corpus. The named-examples block ships empty arrays until Option B's data lands.

---

## Read first

1. **`backend/backend/scripts/run_eval.py`** — scaffold with 7 `TODO(codex)` markers + module docstring describing the contract
2. **`backend/backend/scripts/build_golden_set.py`** — scaffold with 2 `TODO(codex)` markers
3. **`backend/tests/test_run_eval.py`** — 8 unit tests against `compute_metrics`, `compute_histogram`, `build_named_block`. Add `test_build_golden_set.validate` cases during implementation.
4. **`backend/backend/similarity.py`** — `FlatCatalog` + `top_k_neighbors` you'll reuse for the LOO loop
5. **`backend/backend/clap_windowed.py`** — for the (unused-by-LOO) Suno-track encoding path that B might want later

---

## LOO implementation pattern

The catalog `FlatCatalog` is already L2-normalized at startup. For each LOO query:

1. **Don't re-encode anything.** The query "audio" is just the held-out track's pre-computed mean-pooled vector from `embeddings.npy` + its segments from `segment_embeddings.npz`.
2. **Build a held-out `FlatCatalog`** by slicing `means`, `segs_flat`, `seg_ranges`, and `track_ids` to exclude the held-out track. (Or just mask its rank from the top-k result if simpler — your call. Either way no encoding work.)
3. **Call `similarity.top_k_neighbors`** on the held-out catalog.
4. **Score:** the held-out track's `track_id` was the "seed"; record its rank in the returned neighbors (or `None` if not in top-K). Record `top1_score` = `neighbors[0].meanPooledSimilarity`.

This is dramatically cheaper than the original Suno-tracks-from-YAML pipeline — no audio decode, no CLAP forward pass per query. Estimated ~30 seconds for the whole 160-query run.

### Suggested CLI shape

```bash
python -m backend.scripts.run_eval --mode loo
# writes quality-scorer/public/corpus/eval.json
```

Keep `--mode suno` (or just `--mode external`) as a stub that reads `golden_set.json` — the existing YAML-driven flow — and runs the same `compute_metrics` / `compute_histogram` machinery against external audio. Don't implement audio decode there yet; Option B activates that path when user data arrives. Just raise `NotImplementedError` with a clear message for now.

---

## eval.json wire shape — locked

This is what Claude's `EvaluationPage.jsx` reads. Keep the field names + camel-ish casing per the spec; the page will fail safely on missing keys but will render correctly when this shape lands.

```json
{
  "metrics": {
    "recall_at_1": 0.62,
    "recall_at_3": 0.78,
    "mrr": 0.71,
    "n_queries": 160
  },
  "negatives_histogram": {
    "bins": [0.0, 0.05, 0.10, ..., 1.0],
    "counts": [0, 1, 2, 4, ...],
    "step": 0.05
  },
  "named_examples": {
    "false_positives": [],
    "false_negatives": []
  },
  "methodology": "Leave-one-out retrieval check over the 160-track reference catalog. For each track, the track is held out of the index; the remaining 159 are queried using the held-out track's CLAP embedding; the held-out track's rank in the returned top-K is recorded. This measures whether the embedding pipeline correctly finds the seed track when given a hold-out query — a catalog retrieval test, not an end-to-end AI-soundalike test.",
  "limitations": "Catalog is ~160 tracks, with Tier-1 from iTunes previews and Tier-2 from MTG-Jamendo. Tier-2 is anonymized in metadata (e.g. \"Jamendo 43419 — artist_005716\"), so per-artist or per-album similarity confounds may inflate Recall@K relative to a real-world deployment. The eval does NOT measure how the system handles AI-generated soundalikes; that requires Suno-targeted generations, queued as Option B.",
  "manifest": {
    "model_sha": "a0b4534a14f58e20944452dff00a22a06ce629d1",
    "generated_at": "2026-06-12T...",
    "mode": "loo",
    "n_positives": 160,
    "n_negatives": 0
  }
}
```

Notes:

- `negatives_histogram` for LOO: compute the histogram over **top-1 cosines from queries where the held-out track did NOT rank at #1** (those are the "noise floor" cases — the system thought something else was more similar than the seed itself). Document this in the `methodology` if the framing helps; the page will render whatever you put there.
- `named_examples.{false_positives, false_negatives}` start empty. Don't synthesize — Option B's curation produces these.
- `methodology` and `limitations` are full prose strings (no Markdown). The page renders them verbatim inside a styled `<p>`.
- `manifest.mode` distinguishes LOO from the future external (Option B) run.

---

## Setup + verification

```bash
source backend/.venv/bin/activate

# 1. Fast unit tests + new build_golden_set.validate tests:
cd backend
pytest -q tests/test_run_eval.py

# 2. End-to-end LOO run:
cd /Users/rajatarora/Projects/PiedPiper
python -m backend.scripts.run_eval --mode loo
# Expected: ~30 s run; prints R@1, R@3, MRR; writes quality-scorer/public/corpus/eval.json.

# 3. eval.json is reproducible (run twice → same numbers, only `generated_at` differs):
python -m backend.scripts.run_eval --mode loo
cp quality-scorer/public/corpus/eval.json /tmp/eval1.json
python -m backend.scripts.run_eval --mode loo
python -c "
import json
a = json.load(open('/tmp/eval1.json'))
b = json.load(open('quality-scorer/public/corpus/eval.json'))
for d in (a, b):
    d.get('manifest', {}).pop('generated_at', None)
assert a == b, 'eval.json drifted between runs — should be deterministic'
print('reproducible')
"

# 4. Phase 1 + 2 + 5 tests still green:
cd backend
pytest -q tests/test_corpus_ingest.py tests/test_neighbors_endpoint.py tests/test_acrcloud_engine.py
```

---

## Constraints — non-negotiable

1. **L2-normalization preserved.** Don't re-normalize the catalog matrix; the corpus writer already did this at ingest time.
2. **Reproducibility.** Two runs on the same corpus produce byte-identical `eval.json` except for `manifest.generated_at`.
3. **Honest framing.** The `methodology` string must say LOO is a retrieval check, NOT an AI-soundalike eval. The Phase 7 `eval-check.yml` CI workflow re-runs this script and diffs the output, so over-claiming in the prose gets caught.
4. **No new top-level deps.** Everything you need is in `backend/pyproject.toml`'s `[runtime,dev,ingest]` already.
5. **Don't touch frontend.**
6. **No emojis.**

---

## Edge cases

- **A track has only one segment in `segment_embeddings.npz`** — the `top_k_neighbors` math handles variable Wc per track. No special casing needed.
- **`segment_embeddings.npz` keys don't match `corpus.json` track_ids** — Phase 1's test guarantees this; if it ever drifts in a future ingest, `_load_catalog()` should raise. Already covered.
- **Catalog is empty / corpus files missing** — graceful skip, write an `eval.json` with `n_queries: 0` and zero metrics. The page handles this empty-state.
- **`--mode suno` invoked without `golden_set.json`** — raise `NotImplementedError("Option B not yet active; use --mode loo")` with a clear message.

---

## When you're done

Return a short note (under 250 words):

1. Confirm `pytest -q tests/test_run_eval.py` passes (paste output).
2. Confirm Phase 1 + 2 + 5 still green.
3. Paste the R@1 / R@3 / MRR line from the live LOO run.
4. Paste the first 5 bin counts from `negatives_histogram` so we can sanity-check the noise floor lands roughly where expected (`0.70` is the configured threshold; LOO scores should cluster well above that since most catalog tracks will retrieve themselves).
5. Anything you flagged or judgment-called on.

Claude takes the locked `eval.json` shape and renders `EvaluationPage.jsx` in parallel — no further handoff between us until you ship.

Phase 7 (CI + deploy) is the final scaffold; it gates on Phase 6 landing.
