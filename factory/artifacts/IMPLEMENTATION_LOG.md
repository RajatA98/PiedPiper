---
name: IMPLEMENTATION_LOG
description: Per-phase implementation log — what shipped, what passed, what's still open
status: In Progress
last_updated: 2026-06-12
---

# Implementation Log — PiedPiper

Tracks what each phase actually produced versus the plan. Source of truth for "are we shipping?"

---

## Phase 1 — Catalog ingest pipeline · ✅ Shipped (with one open caveat)

**Codex implementation** — see `CODEX_PHASE_1_IMPLEMENTATION_NOTES_FOR_CLAUDE.md` for the full handoff note.

### What shipped

- `backend/backend/clap_windowed.py` — deterministic 10s non-overlapping windowing + L2-normalized mean pooling; single-window equality preserved for clips ≤ 10s.
- `backend/backend/scripts/_itunes_client.py` — iTunes Search + preview byte fetch + rate-limited iterator (~20/min).
- `backend/backend/scripts/_corpus_writer.py` — writes `corpus.json`, `embeddings.npy`, `segment_embeddings.npz`, `examples.json`, `manifest.json`; validates `(512,)` pooled shape, `(n,512)` segments, float32, L2 normalization before write.
- `backend/backend/scripts/rebuild_corpus.py` — orchestrator, end-to-end iTunes Tier-1 ingest. **Discovery during implementation:** soundfile/librosa cannot decode iTunes `.m4a` preview bytes directly, so Codex added a CoreAudio / `audioread` fallback path. Apple stream-not-cache rule respected.
- `backend/backend/scripts/_fma_loader.py` + `_jamendo_loader.py` — best-effort implementations; Tier-2 outcome is caveated below.

### Tests

Run from `backend/`:

```bash
.venv/bin/python -m pytest -q tests/test_corpus_ingest.py                          # ✅ pass (expected skips for empty Tier-2 + missing Phase-6 example audio)
HF_HUB_OFFLINE=1 .venv/bin/python -m pytest -q -m slow tests/test_corpus_ingest.py # ✅ pass (HF_HUB_OFFLINE because Codex sandbox has DNS blocks; model cache already present)
```

### Generated corpus

```text
wrote 10 tracks (tier1=10, tier2=0) -> quality-scorer/public/corpus
```

Files now live and committed-ready under `quality-scorer/public/corpus/`:
- `corpus.json`
- `embeddings.npy`
- `segment_embeddings.npz`
- `examples.json` (empty list — Phase 6 audio not present yet, scaffold skipped correctly)
- `manifest.json` (10 required fields all populated)

### Open caveat — Tier-2 source resolution

The catalog.yaml referenced HF dataset slug `benjamin-paine/free-music-archive` for FMA. **That slug is inaccessible** from HF Hub (404 / hub-misroute). Codex left Tier-2 empty rather than guess at a substitute. This does not break the Phase 1 contract — Tier-1 alone satisfies all locked acceptance criteria — but it does mean we currently have 10 catalog tracks, not the 200–500 target.

**Follow-up task (to schedule before Phase 6):**

- **Phase 1.5 — Tier-2 source resolution.** Try, in priority order: (1) verified HF dataset slugs `mteb/fma_small`, `lewtun/music_genres_small`, or any other FMA mirror surfaced by Hub search; (2) direct download from FMA Small Zenodo archive (`https://os.unil.cloud.switch.ch/fma/fma_small.zip` via httpx); (3) swap to MTG-Jamendo via direct CDN (`https://mp3l.jamendo.com/?trackid={id}`). Update `_fma_loader.py` to the working path and re-run the ingest to populate ~100–300 Tier-2 rows. Acceptance criterion: rerun of `python -m backend.scripts.rebuild_corpus` produces `tier2 >= 100`.

This is a small, focused task — appropriate for Codex via a tight handoff prompt. Will queue after Phase 2 wraps so Phases 2 + 3 + the design work move forward in parallel.

### Phase 1 verdict

Approved. Phase 2 scaffold is the next thing to write.

---

## Entry 2 — 2026-06-11

- **Phase:** Phase 1.5 — Tier-2 source resolution
- **Goal:** Replace the inaccessible FMA Tier-2 source with a working Creative Commons source and regenerate the corpus with `tier_counts.tier2 >= 100`.
- **Tests / Validation Targets:** Manifest assertion for `tier2 >= 100`; `pytest -q tests/test_corpus_ingest.py`; `HF_HUB_OFFLINE=1 pytest -q -m slow tests/test_corpus_ingest.py`.
- **Files Changed:** `backend/backend/scripts/_jamendo_loader.py`, `backend/catalog.yaml`, generated files under `quality-scorer/public/corpus/`.
- **Implementation Summary:** Swapped Tier 2 to MTG-Jamendo. The loader now resolves the MTG-Jamendo metadata pointer, parses real TSV headers/tags, samples balanced candidates across the configured genres, fetches Jamendo CDN MP3s with `mp32` default and `mp31` fallback, and preserves the existing dataclass/signature contract. Rebuilt the corpus to 160 total tracks: 10 Tier-1 iTunes rows and 150 Tier-2 Jamendo rows.
- **Known Issues:** `examples.json` remains empty because Phase 6 Suno example audio is not present yet. Jamendo rows use dataset IDs/fallback labels from the MTG metadata rather than rich human-readable titles.

---

## Entry 3 — 2026-06-11 — Codex

- **Phase:** Phase 2 — Backend `/neighbors` rewiring
- **Goal:** Wire the live similarity endpoint to the Phase 1 windowed CLAP protocol and expose both `meanPooledSimilarity` and `maxSegmentSimilarity`.
- **Tests / Validation Targets:** `pytest -q tests/test_neighbors_endpoint.py -k "not slow"`; `pytest -q tests/test_corpus_ingest.py`; `HF_HUB_OFFLINE=1 pytest -q -m slow tests/test_neighbors_endpoint.py`; local `/health` check.
- **Files Changed:** `backend/backend/similarity.py`, `backend/backend/api.py`.
- **Implementation Summary:** Implemented the flat catalog similarity math, fixed API corpus loading for the top-level-list `corpus.json` shape, loaded `segment_embeddings.npz` and `manifest.json` at startup, switched `/neighbors` to windowed query encoding, and returned `modelSha`, `thresholdDefault`, mean-pooled similarity, and max-segment similarity. `/analyze` remains on the legacy response shape.
- **Validation Result:** Fast Phase 2 tests passed with optional endpoint-fixture skips; Phase 1 corpus ingest tests still passed; `/health` returned `corpus: 160` and `segments: 3495`.
- **Known Issues:** Slow `/neighbors` end-to-end test skipped because `backend/tests/fixtures/tiny.mp3` is not present.

---

## Entry 4 — 2026-06-11 — Claude (frontend phase)

- **Phase:** Phase 3 — Frontend rewire to similarity-first UI
- **Goal:** Flip the visible product from inherited dark Soundcheck quality scorer to the locked PiedPiper similarity-first UI per `ui_mockup_v2_suno_flare.html`.
- **Files Changed:**
  - `src/index.css` — theme tokens replaced (dark phosphor → Pied Piper cream + green + Suno flare); oscilloscope grid + noise overlay removed.
  - `index.html` — fonts swapped to Inter + JetBrains Mono + Outfit.
  - New components: `Nav.jsx` (lowercase wordmark + 2-tone feather glyph), `Footer.jsx` (Easter-egg line + detector sigil row with rose Suno `S`), `Hero.jsx`, `DropZone.jsx`, `ExampleChips.jsx`, `ReportCard.jsx`.
  - Existing scaffold-style components retained: `SimilarityReport.jsx`, `SimilarityRow.jsx`, `AcrCloudRow.jsx`, `SunoPill.jsx`, `QualityBadge.jsx`, `Layout.jsx`.
  - Pages: `ScorerPage.jsx` full rewrite (`neighborsUpload` + `analyzeUpload` parallel, Case A/B via `deriveHeadline`); `EvaluationPage.jsx` (empty state + metric-cards skeleton, full data view deferred to Claude in Phase 6); `AboutPage.jsx` brief PiedPiper overview; `App.jsx` removed dead Corpus route.
  - Deletions: `src/pages/CorpusPage.jsx`.
  - Caught and fixed: `.env.production` still had `CHANGEME-soundcheck.hf.space` placeholder (would have leaked into prod bundle); now `CHANGEME-piedpiper.hf.space`.
  - Tooling: `package.json` adds `vitest@^2`, `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `jsdom@^25`; `npm test` wired to `vitest run`.
- **Validation Result:** `npm run build` → 406 modules, 17.98 KB CSS (was 28.79), 306.49 KB JS, 548 ms. `npm test` → 8 / 8 Vitest tests pass. Final dist-bundle grep returns zero `soundcheck` / `#090b0e` / `#2ee6d6` strings.
- **Scope split note for Phase 6:** Claude owns the `EvaluationPage.jsx` full rewrite (histogram + named FP/FN with audio playback + methodology + limitations). Codex's Phase 6 scope is the backend scripts + tests only (`run_eval.py`, `build_golden_set.py`). The `CODEX_PHASE_6.md` handoff already reflects this split.
- **Known Issues:** None blocking. The 17 dead Soundcheck-era components (`Waveform.jsx`, `ScoreDial.jsx`, `VerdictBadge.jsx`, `SignalRow.jsx`, `AudioPlayer.jsx`, `lib/mockData.js`, `lib/signals.js`, `lib/scoring.js`, etc.) are no longer imported and get tree-shaken out of the bundle. A future cleanup pass can delete them outright.

---

## Entry 5 — 2026-06-12 — Codex

- **Phase:** Phase 5 — ACRCloud backend integration
- **Goal:** Implement the ACRCloud Cover Song ID and AI Music Detector backend adapter behind `ENABLE_ACRCLOUD`, wire it into `/neighbors`, and expose `acrcloudEnabled` on `/health` without leaking credentials.
- **Tests / Validation Targets:** Red/green `pytest -q tests/test_acrcloud_engine.py`; regression `HF_HUB_OFFLINE=1 pytest -q tests/test_corpus_ingest.py tests/test_neighbors_endpoint.py`; disabled-mode local `/health`; disabled-mode `/neighbors` upload using a generated 1-second WAV.
- **Files Changed:** `backend/backend/acrcloud_engine.py`, `backend/backend/api.py`.
- **Implementation Summary:** Implemented the feature gate, HMAC-SHA1 signed ACRCloud Identification request, AI Music Detector bearer-token request, timeout/quota/no-match normalization, per-signal failure isolation, and the locked camelCase response adapter. `_decode_and_pipeline` now prepares a 15-second mono PCM WAV buffer for ACRCloud calls, `/neighbors` returns a top-level `acrcloud` block, the no-corpus branch returns the same disabled shape, and `/health` reports `acrcloudEnabled`.
- **Validation Result:** `tests/test_acrcloud_engine.py` passed 14/14. Corpus/neighbors regression passed with expected skips when run with `HF_HUB_OFFLINE=1`. Local smoke returned `/health` with `corpus: 160`, `segments: 3495`, `acrcloudEnabled: false`; `/neighbors` returned both `coverSongId.status` and `aiMusicDetector.status` as `"disabled"` with no ACRCloud network call.
- **Known Issues:** The first regression run without `HF_HUB_OFFLINE=1` failed because the sandbox cannot reach Hugging Face to resolve CLAP metadata; this is environmental and matches the existing offline-cache workflow. Live ACRCloud credentials were not available, so live-provider behavior is covered by mocked HTTP tests only.

---

## Entry 6 — 2026-06-12 — Codex

- **Phase:** Phase 6 — Backend eval pipeline, Option A leave-one-out scope
- **Goal:** Produce a real, reproducible eval artifact without blocking on user-generated Suno data, while keeping Claude's frontend scope untouched.
- **Tests / Validation Targets:** Red/green `pytest -q tests/test_run_eval.py`; regression `HF_HUB_OFFLINE=1 pytest -q tests/test_corpus_ingest.py tests/test_neighbors_endpoint.py`; live `python -m backend.scripts.run_eval --mode loo` against the 160-track corpus.
- **Files Changed:** `backend/backend/scripts/run_eval.py`, `backend/backend/scripts/build_golden_set.py`, `backend/tests/test_run_eval.py`, `backend/.gitignore`, `quality-scorer/public/corpus/eval.json`.
- **Implementation Summary:** Implemented the fast metric helpers, histogram generation, named-example audio copying, golden-set YAML validation, catalog loading, and a leave-one-out eval mode that reuses existing corpus embeddings instead of re-encoding audio. The LOO mode removes each query row from the temporary index, ranks the remaining catalog with the same `similarity.top_k_neighbors` path used by `/neighbors`, and scores whether another track by the same artist appears in the top-k. The generated `eval.json` keeps the locked frontend shape and includes methodology/limitations text that explicitly frames this as a catalog retrieval sanity check, not a definitive Suno-generation eval.
- **Validation Result:** `tests/test_run_eval.py` passed 9/9. Corpus/neighbors regression passed with expected skips in offline mode. `run_eval --mode loo` wrote `quality-scorer/public/corpus/eval.json` with R@1=0.394, R@3=0.494, MRR=0.458, n=160, `eval_mode: "loo"`, and empty named FP/FN arrays.
- **Known Issues:** The LOO histogram is a catalog top-1 score distribution, not a true unrelated-negatives noise floor. The generated methodology and limitations say this explicitly. Named FP/FN examples remain empty until user-provided Suno examples and curated notes exist.
