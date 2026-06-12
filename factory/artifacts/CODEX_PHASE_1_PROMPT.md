# Codex handoff — PiedPiper Phase 1 (catalog ingest)

> Self-contained. Paste this into Codex and point it at the repo. Codex needs no other context — all referenced files exist in the repo.

---

## What you're building

PiedPiper is a deployed web app that takes an AI-generated audio track (typically Suno output) and returns the top 3 closest real songs from a reference catalog, each with a similarity %. Phase 1 of the implementation is the **catalog ingest pipeline** that builds that reference corpus.

**Your job:** Implement the function bodies in the files scaffolded by Claude. Each scaffold file has type-hinted signatures, docstrings explaining the contract, and explicit `TODO(codex)` markers showing exactly what to fill in. Do NOT change the signatures or move files — the signatures encode design decisions locked in `factory/artifacts/LOCKED_DECISIONS.md`.

## Read first

In this order — they are the source of truth Claude wrote the scaffold against:

1. `factory/artifacts/LOCKED_DECISIONS.md` — especially the **"Catalog"**, **"Catalog freshness"**, **"Audio embedding model"**, and **"Track-length normalization (binding)"** sections.
2. `factory/artifacts/PROJECT_PLAN.md` — **Phase 1** section, including the locked manifest schema (10 required fields) and the segment_embeddings.npz requirement.
3. `factory/artifacts/PRESEARCH.md` — **Q7 (catalog source)** and **Q3 (catalog freshness)** for trade-off context. (Skim if short on time.)

## Files to implement (TODOs are marked)

All paths are repo-relative:

### Core scaffolded files

| File | Role | Notes |
|---|---|---|
| `backend/backend/clap_windowed.py` | Shared windowed CLAP encoder | Wraps existing `backend/backend/clap_engine.encode_audio()`. Three TODOs: `chunk_audio`, `encode_windowed`, `l2_normalize`. |
| `backend/backend/scripts/_itunes_client.py` | iTunes Search API client | Uses `httpx`. Three TODOs: `search_track`, `fetch_preview`, `rate_limited_iterator`. |
| `backend/backend/scripts/_fma_loader.py` | FMA Tier-2 loader | Use HuggingFace `datasets` (already a runtime dep). Two TODOs: `load_fma_tracks`, `fetch_track_audio`. |
| `backend/backend/scripts/_jamendo_loader.py` | MTG-Jamendo Tier-2 loader | Optional — Tier-2 fallback. Same shape as FMA loader. Two TODOs. |
| `backend/backend/scripts/_corpus_writer.py` | Output writers | Five TODOs: `write_corpus`, `write_examples`, `write_manifest`, `compute_sha256`, and the array L2-norm assertions inside `write_corpus`. |
| `backend/backend/scripts/rebuild_corpus.py` | Orchestrator (`main()`) | Six TODOs: `ingest_tier1`, `ingest_tier2`, `build_examples`, `_load_catalog_yaml`, `_decode_to_mono`, `_resolve_model_sha`. |

**Note on package layout:** the scripts live INSIDE the installed `backend` package (at `backend/backend/scripts/`), not as loose scripts. After `pip install -e "backend/[runtime,ingest,dev]"`, they're importable as `backend.scripts.*` and runnable as `python -m backend.scripts.rebuild_corpus`. Use `from backend import config` — NEVER `from backend.backend import ...` (that path does not exist).

### Files already complete (do NOT modify)

| File | Why locked |
|---|---|
| `backend/catalog.yaml` | Seed list of 10 Tier-1 entries; expand later when the user is ready to ingest. |
| `backend/tests/test_corpus_ingest.py` | Encodes every Phase 1 acceptance criterion. Your implementation must make these tests pass. |
| `backend/backend/clap_engine.py` | Existing CLAP engine — use it from `clap_windowed.py`, never re-load the model. |
| `backend/backend/config.py` | Constants you'll need: `CLAP_MODEL_ID`, `CLAP_EMBED_DIM`, `CLAP_WINDOW_SECONDS`, `CLAP_QUERY_MAX_SECONDS`, `CLAP_POOLING`, `SIMILARITY_THRESHOLD_DEFAULT`, `ANALYSIS_SR`, `CLIP_CAP_S`. |
| `backend/pyproject.toml` | The `ingest` optional-dependencies group adds `httpx` + `pyyaml`. Install with `pip install -e "backend/[runtime,ingest,dev]"`. |

## Setup

```bash
cd /Users/rajatarora/Projects/PiedPiper
pip install -e "backend/[runtime,ingest,dev]"
```

## How to verify you're done

```bash
# 1. Fast unit tests (no ML model loaded):
cd backend
pytest -q tests/test_corpus_ingest.py

# 2. Slow tests (loads CLAP — opt-in via the `slow` marker, mirrors pyproject convention):
pytest -q -m slow tests/test_corpus_ingest.py

# 3. End-to-end ingest against the 10 starter tier1 entries (run from repo root):
cd /Users/rajatarora/Projects/PiedPiper
python -m backend.scripts.rebuild_corpus

# Expected outputs in quality-scorer/public/corpus/:
#   - corpus.json              (10 tier1 rows; tier2 only if FMA loader succeeds)
#   - embeddings.npy           (N, 512), L2-normalized
#   - segment_embeddings.npz   per-track per-window matrices
#   - manifest.json            (10 required fields)
#   - examples.json            (3–5 entries with both similarities)
#   - NO audio files (.mp3 / .aac / etc.) in that directory.
```

## Constraints — non-negotiable

1. **Apple stream-not-cache rule** (LOCKED_DECISIONS, Catalog section): iTunes preview bytes are held in memory only for the duration of the CLAP encode, then discarded. Never write `.mp3`/`.aac`/`.wav` files into `quality-scorer/public/corpus/`. The test `test_no_audio_bytes_committed_to_corpus_dir` enforces this.
2. **Single shared CLAP model load**: import `clap_engine` and call its functions. Do NOT add a second `from_pretrained` call anywhere.
3. **L2-normalization**: every row of `embeddings.npy` and every row of every value in `segment_embeddings.npz` must have norm == 1.0 within 1e-4 tolerance. The pooled vector is the L2-normalized arithmetic mean of the per-window vectors.
4. **Manifest schema** (PROJECT_PLAN Phase 1, Codex review fix #4): all 10 fields required: `model_id`, `model_sha`, `embedding_dim`, `window_seconds`, `query_max_seconds`, `pooling`, `threshold_default`, `tier_counts`, `generated_at`, `sha256`. Tests fail if any is missing.
5. **Don't change scaffold structure**: don't rename files, don't change function signatures, don't move code between files. If you think a signature is wrong, raise it in your handoff-back note — don't silently rewrite.
6. **Don't introduce new deps** beyond what `backend/pyproject.toml` allows. If you genuinely need one, add it to `[ingest]` and call it out in your handoff-back note.
7. **No emojis in code or output messages** unless the user explicitly asked for them (they didn't here).

## Edge cases to handle

- iTunes returns `resultCount: 0` for some `(title, artist)` queries — log "skip: <title> by <artist>" and continue. Don't crash the ingest.
- iTunes preview download occasionally fails with 5xx — retry once after 2 s sleep, then skip.
- Tier-2 source unavailable (HF dataset not cached, network blip) — log the failure, skip Tier-2 entirely, continue with Tier-1 only. Tests don't require Tier-2 to be present (see `test_tier2_rows_have_license_and_source_url` — it skips if no Tier-2).
- Window count math: a 30 s preview at exactly 30 s gives 3 windows. A 28 s preview gives 2 full windows + a 8 s tail; the tail is kept because 8/10 = 0.8 ≥ `MIN_TAIL_FRAC` (0.5). A 31 s preview gives 3 windows + a 1 s tail; the tail is dropped (1/10 = 0.1 < 0.5).

## When you're done

Return:

1. **A short summary** (under 250 words):
   - What you implemented.
   - Test results (`pytest -q` output for both fast + slow runs).
   - Anything you flagged or skipped, with reason.
2. **The implemented files** (modified scaffold files only — Claude will review against the contract before approving).

Do NOT modify `factory/artifacts/*`, `quality-scorer/public/corpus/*` outside what `rebuild_corpus.py` writes, or anything in `quality-scorer/src/`. Phase 2 (backend wiring) and Phase 3 (frontend rewire) are Claude-scaffolded next; you'll get those handoffs after Phase 1 is reviewed and merged.
