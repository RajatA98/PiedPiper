---
name: CODEX_PHASE_1
description: Phase 1 implementation handoff for Codex — catalog ingest pipeline. Self-contained; point Codex at this file and it can implement end-to-end.
status: Ready
last_updated: 2026-06-10
---

# Phase 1 implementation — Catalog ingest pipeline

**For Codex. Read this file end-to-end, then implement.**

---

## Quick orientation

**PiedPiper** is a deployed web app: a user uploads an AI-generated music track (typically Suno output); the app returns the top 3 closest real songs from a reference catalog, each with a similarity percentage, ranked highest first. If nothing crosses the similarity threshold, the headline is `"Completely unique — this track doesn't sound like anything in our reference catalog"`.

**Phase 1** is the offline catalog ingest pipeline that builds that reference corpus. Without it, the live `/neighbors` backend endpoint returns `no_corpus` for every request and the product has nothing to compare against.

**Your job:** fill in the function bodies marked `TODO(codex)` in the files listed below. Claude scaffolded the file structure, function signatures, docstrings, constants, and tests. Each TODO has a contract docstring explaining exactly what to implement. Do not change the signatures or move files — the structure encodes design decisions locked in `factory/artifacts/LOCKED_DECISIONS.md`.

When you're done, all 11 fast tests in `backend/tests/test_corpus_ingest.py` should pass on the committed corpus output, and all 3 slow tests should pass with `pytest -m slow`.

---

## Read first (source of truth)

In this order:

1. **`factory/artifacts/LOCKED_DECISIONS.md`** — specifically the **"Catalog"**, **"Catalog freshness"**, **"Audio embedding model"**, and **"Track-length normalization (binding)"** sections. These are the contract.
2. **`factory/artifacts/PROJECT_PLAN.md`** — **Phase 1** section. The 10-field manifest schema and the `segment_embeddings.npz` requirement are non-negotiable.
3. **`factory/artifacts/PRESEARCH.md`** — Q7 (catalog source) and Q3 (catalog freshness) for trade-off context. Skim only if needed for judgment calls.

---

## Package layout — important

The installed Python package is **`backend`**, not `backend.backend`. The directory layout `backend/backend/` is a hatchling build-config convention; after `pip install -e backend/`, the import root is `backend`.

- ✅ `from backend import config`
- ✅ `from backend import clap_engine, clap_windowed`
- ✅ `from backend.scripts import ...`
- ❌ `from backend.backend import ...` (does NOT exist as an import path)

The new Phase 1 scripts live at `backend/backend/scripts/` on disk so they ship inside the installed `backend` package, and are runnable as `python -m backend.scripts.rebuild_corpus`.

---

## Files to implement

All files are scaffolded with type hints, docstrings, and `TODO(codex)` markers. Implement each TODO; tests verify the result.

| File | Role | TODOs |
|---|---|---|
| `backend/backend/clap_windowed.py` | Shared 10s-window CLAP encoder. Wraps existing `clap_engine.encode_audio()`. | `chunk_audio`, `encode_windowed`, `l2_normalize` |
| `backend/backend/scripts/_itunes_client.py` | iTunes Search API client | `search_track`, `fetch_preview`, `rate_limited_iterator` |
| `backend/backend/scripts/_fma_loader.py` | FMA Tier-2 loader (HuggingFace `datasets`) | `load_fma_tracks`, `fetch_track_audio` |
| `backend/backend/scripts/_jamendo_loader.py` | MTG-Jamendo Tier-2 loader (optional alt to FMA) | `load_jamendo_tracks`, `fetch_track_audio` |
| `backend/backend/scripts/_corpus_writer.py` | Writes the 5 output corpus files with sha256 | `write_corpus`, `write_examples`, `write_manifest`, `compute_sha256` |
| `backend/backend/scripts/rebuild_corpus.py` | Top-level orchestrator (`main()`) | `ingest_tier1`, `ingest_tier2`, `build_examples`, `_load_catalog_yaml`, `_decode_to_mono`, `_resolve_model_sha` |

**Approximately 21 function bodies total.** Most are 5–30 lines each.

## Files already complete — do NOT modify

| File | Why locked |
|---|---|
| `backend/catalog.yaml` | Seed Tier-1 list of 10 starter tracks. User will expand toward ~100 once the pipeline works. |
| `backend/tests/test_corpus_ingest.py` | Encodes every Phase 1 acceptance criterion. Your implementation must make these pass. |
| `backend/backend/clap_engine.py` | Existing CLAP engine (`encode_audio(wav, sr) → L2-normalized (512,) float32`). Use it from `clap_windowed.py`; do NOT load CLAP a second time. |
| `backend/backend/config.py` | Constants: `CLAP_MODEL_ID`, `CLAP_EMBED_DIM=512`, `CLAP_WINDOW_SECONDS=10`, `CLAP_QUERY_MAX_SECONDS=90`, `CLAP_POOLING="l2_normalized_mean"`, `SIMILARITY_THRESHOLD_DEFAULT=0.70`, `ANALYSIS_SR=22050`, `CLIP_CAP_S=90`. |
| `backend/pyproject.toml` | Already has the `ingest` optional-dependencies group (`httpx`, `pyyaml`). |
| Anything under `factory/artifacts/`, `quality-scorer/src/`, or `quality-scorer/public/corpus/` (except files your script writes to the corpus dir) | Out of Phase 1 scope. |

---

## Setup

```bash
cd /Users/rajatarora/Projects/PiedPiper
pip install -e "backend/[runtime,ingest,dev]"
```

## How to verify you're done

```bash
# 1. Fast unit tests (no ML model loaded — verifies output file shapes and schemas):
cd backend
pytest -q tests/test_corpus_ingest.py

# 2. Slow tests (loads CLAP — verifies windowing/L2 contract end-to-end):
pytest -q -m slow tests/test_corpus_ingest.py

# 3. End-to-end ingest run (from repo root):
cd /Users/rajatarora/Projects/PiedPiper
python -m backend.scripts.rebuild_corpus
```

After (3) the following files must exist in `quality-scorer/public/corpus/`:
- `corpus.json` — ≥10 Tier-1 rows; Tier-2 only if FMA loader succeeded
- `embeddings.npy` — shape `(N, 512)`, dtype `float32`, rows L2-normalized
- `segment_embeddings.npz` — keyed by `track_id`, each value shape `(num_windows_i, 512)`, rows L2-normalized
- `manifest.json` — all 10 required fields (see Constraints #4)
- `examples.json` — 3–5 staged precomputed query responses with both similarity metrics

**No audio files** (`.mp3`, `.aac`, `.wav`, etc.) anywhere in that directory.

After (1) and (2), test runs should show:
- Fast: 11 passed (or some skipped with reason "corpus files not yet generated" if you run before the ingest — that's fine on first pass; run the ingest, then re-run tests)
- Slow: 3 passed

---

## Constraints — non-negotiable

1. **Apple stream-not-cache rule.** iTunes preview AAC bytes are held in memory only for the duration of the CLAP encode, then discarded. Never write `.mp3` / `.aac` / `.wav` files into `quality-scorer/public/corpus/`. The test `test_no_audio_bytes_committed_to_corpus_dir` enforces this.
2. **Single shared CLAP model load.** Import and call `clap_engine.encode_audio()`. Do NOT add a second `from_pretrained` call anywhere.
3. **L2-normalization.** Every row of `embeddings.npy` and every row of every value in `segment_embeddings.npz` must have norm == 1.0 within 1e-4 tolerance. The pooled vector is the L2-normalized arithmetic mean of the per-window vectors.
4. **Manifest schema** — all 10 fields required: `model_id`, `model_sha`, `embedding_dim`, `window_seconds`, `query_max_seconds`, `pooling`, `threshold_default`, `tier_counts`, `generated_at`, `sha256`. Tests fail if any is missing.
5. **Don't change scaffold structure.** Don't rename files, don't change function signatures, don't move code between files. If you think a signature is wrong, flag it in your handoff-back note — don't silently rewrite.
6. **No new deps** beyond `backend/pyproject.toml`'s `[runtime]`, `[ingest]`, `[dev]` groups. If you genuinely need one, add it to `[ingest]` and call it out.
7. **No emojis** in code, output messages, or commit messages.

---

## Edge cases to handle

- **iTunes returns `resultCount: 0`** for some `(title, artist)` queries — log `"skip: <title> by <artist>"` and continue. Don't crash the ingest.
- **iTunes preview download fails with 5xx** — retry once after 2 s sleep, then skip.
- **Tier-2 source unavailable** (HF dataset not cached, network blip) — log the failure, skip Tier-2 entirely, continue with Tier-1 only. Tests don't require Tier-2 to be present.
- **Window count math** (`clap_windowed.chunk_audio`): a 30 s preview at exactly 30 s gives 3 windows. A 28 s preview gives 2 full windows + an 8 s tail; the tail is kept because 8/10 = 0.8 ≥ `MIN_TAIL_FRAC` (0.5). A 31 s preview gives 3 windows + a 1 s tail; the tail is dropped (1/10 = 0.1 < 0.5).
- **Single-clip equality case** (`encode_windowed`): a 10 s input must produce exactly 1 window, and the pooled output must equal `clap_engine.encode_audio(wav, sr)` within `1e-5` tolerance. This anchors the Phase 2 windowing test — get this right.
- **Example audio files don't exist yet** — they're Suno generations that arrive in Phase 6. `build_examples()` MUST gracefully skip specs whose `query_audio` file is missing (log info-line, continue), and return whatever was successfully built (possibly an empty list). Phase 1 tests accept 0–5 examples; the three example-related tests `pytest.skip()` when `examples.json` is empty. Do NOT raise on missing audio — that's the contract.

---

## When you're done

Return:

1. **A short summary** (under 250 words):
   - What you implemented.
   - Test results — paste the output of both `pytest -q tests/test_corpus_ingest.py` and `pytest -q -m slow tests/test_corpus_ingest.py`.
   - Anything you flagged or skipped, with reason.
2. **The implemented files** — modified scaffold files only. Claude will review against the contract before approving Phase 2 scaffold.

Do NOT modify:
- `factory/artifacts/*` (these are the contract; don't rewrite the spec)
- `quality-scorer/src/` (Phase 3 territory)
- `quality-scorer/public/corpus/*` outside what `rebuild_corpus.py` writes
- `backend/backend/api.py`, `clap_engine.py`, `librosa_engine.py`, `scoring.py`, etc. (Phase 2 territory)

When Phase 1 is reviewed and approved, you'll receive `CODEX_PHASE_2.md` for the backend wiring work.
