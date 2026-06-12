---
name: CODEX_PHASE_2
description: Phase 2 implementation handoff for Codex — wire `/neighbors` to windowed encoding + segment embeddings + new response shape. Self-contained.
status: Ready
last_updated: 2026-06-11
---

# Phase 2 implementation — Backend `/neighbors` rewiring

**For Codex. Read this file end-to-end, then implement.**

---

## Quick orientation

Phase 1 + 1.5 shipped: corpus has 10 Tier-1 iTunes tracks + 150 Tier-2 Jamendo tracks = **160 tracks** with mean-pooled `embeddings.npy`, per-window `segment_embeddings.npz`, and `manifest.json` carrying `model_sha` + `threshold_default = 0.70`.

Phase 2 wires the live `/neighbors` endpoint to:

1. **Run windowed CLAP encoding** on every query (the same protocol Phase 1 used for the catalog), via the already-shipped `backend.clap_windowed.encode_windowed`.
2. **Surface BOTH similarity metrics per neighbor**:
   - `meanPooledSimilarity` (the primary rank signal, headline percentage)
   - `maxSegmentSimilarity` (secondary, surfaces local resemblance the mean would wash out)
3. **Expose `modelSha` + `thresholdDefault`** at the top level of the response. Frontend uses these for audit and to apply the Case-A / Case-B headline rule (PRESEARCH Q1).
4. **Drop the multi-band verdict logic** (`_SIM_NEAR_DUP`, `_SIM_SIMILAR`, `_SIM_RELATED`, `_verdict_for`). Per LOCKED_DECISIONS the chip is gone — the percentage is the answer.

`/analyze` keeps working unchanged. The frontend's quality badge depends on it. Backwards-compat is hard-required.

---

## Read first

1. **`factory/artifacts/LOCKED_DECISIONS.md`** — sections **"Track-length normalization (binding)"**, **"Similarity threshold"**, **"Vector search"**.
2. **`factory/artifacts/PROJECT_PLAN.md`** — **Phase 2** section.
3. **`backend/backend/clap_windowed.py`** — the encoder you'll call (`encode_windowed(wav, sr, max_seconds=...)` returns `(mean_pooled: (512,), segs: (Q, 512))`).
4. **`backend/backend/similarity.py`** — Phase 2 scaffold with TODOs you implement.
5. **`backend/tests/test_neighbors_endpoint.py`** — the contract; make these pass.

---

## Package layout reminder

Installed package is `backend`. Use `from backend import similarity, clap_windowed, config`. NOT `from backend.backend import ...`.

---

## Files to implement / modify

### NEW — implement the TODOs

| File | Role | TODOs |
|---|---|---|
| `backend/backend/similarity.py` | All ranking math, kept separate from API for testability | `build_flat_catalog`, `top_k_neighbors`, `threshold_from_manifest` |

### MODIFY — integration points in `backend/backend/api.py`

The current `api.py` already has working `/analyze` + `/neighbors` endpoints. Your job is targeted edits, not a rewrite. Specific changes, in order:

1. **Drop the obsolete threshold constants and verdict mapper** (lines ~48–51 + ~195–202):
   ```python
   _SIM_NEAR_DUP = 0.95
   _SIM_SIMILAR = 0.85
   _SIM_RELATED = 0.70

   def _verdict_for(sim): ...
   ```
   These are replaced by the single threshold from the manifest. Delete them.

2. **Extend `_load_corpus()` (around line 61)** to also load:
   - **Fix the `corpus.json` shape parse — current api.py is broken.** Line 78 reads `_corpus_tracks = data.get("tracks", [])`, which assumes the file is `{"tracks": [...]}`. But Phase 1's `_corpus_writer.write_corpus` outputs a top-level JSON list (verified by `test_tier1_rows_have_attribution_and_track_view_url` which iterates `corpus` directly after `json.loads`). Right now `data.get("tracks", [])` silently returns `[]`, so `/neighbors` returns `no_corpus` despite the 160-track corpus on disk. **Change line 78 from `_corpus_tracks = data.get("tracks", [])` to `_corpus_tracks = data if isinstance(data, list) else data.get("tracks", [])` (or just `_corpus_tracks = data` — the list shape is the locked contract).** Either way, the result must align with `embeddings.npy`'s row order.
   - `segment_embeddings.npz` (via `np.load`, then `dict(npz_file)` to materialize keys at startup so the request hot path doesn't re-open the file).
   - `manifest.json` (parse as dict; need `model_sha` + `threshold_default`).
   - Build a module-level `_flat_catalog: FlatCatalog | None` using `similarity.build_flat_catalog(...)`. Set it to `None` and log when any of the four corpus files is missing.
   - Add a module-level `_model_sha: str = ""` and `_threshold_default: float = config.SIMILARITY_THRESHOLD_DEFAULT` populated from the manifest.

3. **Extend `_decode_and_pipeline()` (around line 129)** to also return windowed embeddings:
   - After the existing `mono` truncation to `CLIP_CAP_S` seconds, call `clap_windowed.encode_windowed(mono, sr, max_seconds=None)` — `max_seconds=None` because `mono` is already truncated above.
   - Return both `mean_pooled` (replace the existing `emb` field for backwards-compat — they're the same shape and meaning) and `segment_embeddings` shape (Q, 512).
   - The existing `top_genres` / `report` paths consume the mean-pooled vector; they keep working unchanged.

4. **Rewrite the `/neighbors` endpoint body (around line 205)** to:
   - On `no_corpus` (i.e., `_flat_catalog is None`), return the existing shape with `verdict: "no_corpus"` — the only place the word `verdict` survives.
   - Otherwise call `similarity.top_k_neighbors(query_mean, query_segs, _flat_catalog, k=k)`.
   - For each returned neighbor dict, attach the full catalog metadata row from `_corpus_tracks` (matched by `trackId`). The frontend needs `title`, `artist`, `track_view_url`, `source`, etc.
   - Build the response:
     ```python
     {
       "query": query_track,
       "neighbors": [...],            # the result of top_k_neighbors + metadata attached
       "topMeanPooledSimilarity": float(neighbors[0]["meanPooledSimilarity"]),
       "topMaxSegmentSimilarity": float(neighbors[0]["maxSegmentSimilarity"]),
       "modelSha": _model_sha,
       "thresholdDefault": _threshold_default,
     }
     ```
   - Do NOT add a `verdict` string for the success case. The frontend applies the threshold rule and renders the headline. `verdict: "no_corpus"` survives only as the empty-state signal.

5. **Update `/health`** to include `modelSha` and a `segments` count alongside `corpus`:
   ```python
   {
     "ok": True,
     "model": clap_engine.model_id(),
     "modelSha": _model_sha,
     "version": __version__,
     "corpus": len(_corpus_tracks),
     "segments": int(_flat_catalog.segs_flat.shape[0]) if _flat_catalog else 0,
   }
   ```

### Tests — write or extend

The Phase 2 test file `backend/tests/test_neighbors_endpoint.py` already exists with the full contract. Your implementation must make all the fast tests pass. The TestClient tests gracefully skip if the corpus or a tiny audio fixture isn't present — that's expected behavior.

To run the end-to-end TestClient tests locally, place a small mp3 at `backend/tests/fixtures/tiny.mp3` (~30 s, any audio file). Do not commit it.

---

## Setup

The Phase 1 venv at `backend/.venv` is already set up with all dependencies. From repo root:

```bash
source backend/.venv/bin/activate
```

## How to verify you're done

```bash
# 1. Fast similarity-module tests (no CLAP, no corpus needed):
cd backend
pytest -q tests/test_neighbors_endpoint.py -k "not slow"

# 2. Slow CLAP round-trip test (skips gracefully if fixture absent):
pytest -q -m slow tests/test_neighbors_endpoint.py

# 3. Existing Phase 1 tests still pass:
pytest -q tests/test_corpus_ingest.py

# 4. /health from a running server:
.venv/bin/uvicorn backend.api:app &
curl -s http://localhost:8000/health | python -m json.tool
# Expected: ok=true, modelSha non-empty, corpus>=160, segments>=160.
kill %1
```

---

## Constraints — non-negotiable

1. **`/analyze` must keep working unchanged.** Phase 3's quality badge consumes its current response shape. The test `test_analyze_endpoint_still_returns_legacy_shape` enforces this.
2. **No re-normalization in `build_flat_catalog`.** The corpus writer already L2-normalized everything at ingest time. Re-normalizing here would mask any upstream contract bug.
3. **Single CLAP load.** Reuse `clap_engine.encode_audio` via `clap_windowed.encode_windowed`. Don't add a second `from_pretrained` call.
4. **Don't change function signatures in `similarity.py`.** The tests import them by name; changing signatures breaks the contract.
5. **Don't add new top-level deps.** Everything you need is in `backend/pyproject.toml`'s `[runtime]` group already.
6. **No emojis.** Anywhere — code, logs, comments.
7. **Don't touch** anything under `factory/artifacts/`, `quality-scorer/src/`, or the Phase 1 ingest scripts (`backend/backend/scripts/*`).

---

## Edge cases to handle

- **`segment_embeddings.npz` keys lose float32 / become 0-dim** when read with `np.load(...)`. Materialize to a `dict[str, np.ndarray]` at startup: `{k: npz[k].astype(np.float32) for k in npz.files}`.
- **Manifest missing `model_sha`** (could happen for older corpora) — set `_model_sha = "unpinned"` and continue. Log a warning. Don't crash the server on startup.
- **Empty catalog at startup** — set `_flat_catalog = None`. `/neighbors` returns the existing `no_corpus` shape. `/health` reports `corpus: 0, segments: 0`. Server still serves `/analyze` for the quality badge.
- **Empty query** (silent audio, very short clip) — the encoder already returns at least 1 segment. No special handling needed.
- **Concurrent requests** — the existing `_clap_lock` serializes CLAP encodes; that stays. The catalog matrices are read-only after startup, so no additional locking needed.

---

## When you're done

Return a short note (under 250 words):

1. Confirmation that all fast tests pass (paste `pytest -q tests/test_neighbors_endpoint.py -k "not slow"` output).
2. Confirmation that Phase 1 tests still pass (`pytest -q tests/test_corpus_ingest.py`).
3. The output of `curl http://localhost:8000/health` from a local uvicorn run (or note if you couldn't run the server in your sandbox).
4. Any flags or design judgment calls you made.

Phase 3 (frontend rewire) scaffolds next. After Phase 2 lands clean, Claude scaffolds React components against the new response shape.
