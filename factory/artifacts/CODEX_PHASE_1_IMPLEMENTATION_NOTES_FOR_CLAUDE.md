# Codex Phase 1 Implementation Notes for Claude

Claude,

Codex implemented the Phase 1 ingest scaffold from `CODEX_PHASE_1.md` without changing the frontend or broadening scope beyond the listed backend ingest files.

## Implemented

- `backend/backend/clap_windowed.py`
  - Added deterministic non-overlapping 10s windowing.
  - Added segment encoding, mean pooling, and final L2 normalization.
  - Preserves single-window behavior for clips shorter than the window.

- `backend/backend/scripts/_itunes_client.py`
  - Added iTunes Search API lookup.
  - Added preview byte fetch.
  - Added conservative rate-limited iteration.

- `backend/backend/scripts/_corpus_writer.py`
  - Writes `corpus.json`, `embeddings.npy`, `segment_embeddings.npz`, `examples.json`, and `manifest.json`.
  - Validates `(512,)` pooled vectors, `(n, 512)` segment vectors, float32 dtype, and L2 normalization before writing.

- `backend/backend/scripts/rebuild_corpus.py`
  - Wires Tier 1 iTunes ingest end to end.
  - Keeps Apple preview audio ephemeral; no downloaded preview audio is persisted.
  - Adds a CoreAudio/audioread fallback for iTunes `.m4a` previews because SoundFile/librosa cannot decode those bytes directly on this machine.
  - Skips missing Phase 6 example audio cleanly and writes an empty `examples.json` when no examples are available yet.
  - Handles Tier 2 source failure as non-fatal.

- `backend/backend/scripts/_fma_loader.py` and `_jamendo_loader.py`
  - Added best-effort loader/fetcher implementations, but Tier 2 remains caveated below.

## Generated Output

Rebuild command run from `backend/`:

```bash
.venv/bin/python -m backend.scripts.rebuild_corpus
```

Result:

```text
wrote 10 tracks (tier1=10, tier2=0) -> quality-scorer/public/corpus
```

Generated files:

- `quality-scorer/public/corpus/corpus.json`
- `quality-scorer/public/corpus/embeddings.npy`
- `quality-scorer/public/corpus/segment_embeddings.npz`
- `quality-scorer/public/corpus/examples.json`
- `quality-scorer/public/corpus/manifest.json`

## Validation

Passed:

```bash
backend/.venv/bin/python -m compileall backend/backend
.venv/bin/python -m pytest -q tests/test_corpus_ingest.py
HF_HUB_OFFLINE=1 .venv/bin/python -m pytest -q -m slow tests/test_corpus_ingest.py
```

Notes:

- The normal Phase 1 corpus tests pass with expected skips for missing Phase 6 example audio and absent Tier 2 rows.
- The slow tests require `HF_HUB_OFFLINE=1` in this sandbox because direct Hugging Face DNS requests are blocked here, while the CLAP model cache is already present.

## Remaining Caveat

Tier 2 did not produce rows because the planned FMA Hugging Face dataset slug is inaccessible from this environment:

```text
Dataset 'benjamin-paine/free-music-archive' doesn't exist on the Hub or cannot be accessed.
```

This does not block Phase 1’s Tier 1 corpus contract, but the Tier 2 source decision should be revisited before scaling toward the 100-300 track breadth target.

