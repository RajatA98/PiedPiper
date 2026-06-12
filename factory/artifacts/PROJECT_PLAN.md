---
name: PROJECT_PLAN
description: Phased implementation plan for PiedPiper — 7 demoable phases with objective, deliverables, acceptance criteria, risk notes, and dependencies
status: Complete
last_updated: 2026-06-10
---

# Project Plan — PiedPiper

Phased implementation plan derived from [PRD](PRD.md) + [PRESEARCH](PRESEARCH.md) + [LOCKED_DECISIONS](LOCKED_DECISIONS.md). Each phase is independently demoable. The Implementation phase (Project Factory `/implement`) will execute these in order.

## Inherited codebase state

- `backend/backend/` — FastAPI service with `/analyze` AND `/neighbors` already implemented (`api.py:205-245`). CLAP engine wired (`clap_engine.py`). Librosa quality signals wired. Catalog-loading scaffolding present (`api.py:54-89`) but `quality-scorer/public/corpus/` is empty — `/neighbors` currently returns `no_corpus` for every request.
- `quality-scorer/` — React + Vite frontend, still branded "Soundcheck" end to end. `src/lib/api.js` exposes only `analyzeUpload()` → `/analyze`. UI headline is "Is this generated track technically sound?" — wrong thesis for PiedPiper.
- `deploy/hf_space/` — Dockerfile + app.py for HF Space deploy. Functional.

So Implementation breaks into: (a) build the catalog, (b) wire the backend to the windowed-embedding protocol, (c) rewire the frontend to similarity-first, (d) rename + add rights docs, (e) integrate ACRCloud, (f) build the eval, (g) ship CI + deploy polish.

## Phase order

**1 → 2 → (3 ‖ 4) → (5 ‖ 6) → 7**. Phases 3 and 4 are parallelizable (frontend rewire is orthogonal to renaming + rights docs). Phases 5 and 6 are also parallelizable: Phase 6 has hard dependencies on Phases 1 + 3 only — if Phase 5 lands first, Phase 6 enriches the eval with ACRCloud per-signal data; otherwise Phase 6 ships retrieval-only metrics.

---

## Phase 1 — Catalog ingest pipeline (foundation)

The whole product depends on this; without a populated corpus, `/neighbors` returns `no_corpus`.

**Objective:** Produce `corpus.json` + `embeddings.npy` + `manifest.json` + `examples.json` with ~100 iTunes-sourced Tier-1 tracks + ~200–400 FMA / MTG-Jamendo Tier-2 tracks.

**Deliverables:**

- `scripts/rebuild_corpus.py` — iTunes Search API client + FMA/MTG-Jamendo loaders + CLAP encoder using the 10s windowed mean-pool protocol from LOCKED_DECISIONS.
- `catalog.yaml` — hand-curated Tier-1 track list (~100 entries: `title`, `artist`, `expected_genre`).
- Five output files committed under `quality-scorer/public/corpus/`:
  - `corpus.json` — track metadata
  - `embeddings.npy` — L2-normalized **mean-pooled** track vectors `(N, 512)` (used for the headline ranking)
  - `segment_embeddings.npz` — per-window L2-normalized segment vectors per track (variable-length, indexed by `track_id`) — required for the `maxSegmentSimilarity` computation in Phase 2
  - `manifest.json` — schema below
  - `examples.json` — 3–5 staged precomputed query responses

**Acceptance criteria:**

- `python scripts/rebuild_corpus.py` runs end-to-end with the CLAP `revision=` SHA pinned.
- Each Tier-1 row in `corpus.json` includes `attributionRequired: true` and the `trackViewUrl` link-out.
- **`manifest.json` contains every required field:** `model_id`, `model_sha`, `embedding_dim`, `window_seconds`, `query_max_seconds`, `pooling`, `threshold_default`, `tier_counts` (`{tier1: N, tier2: N}`), `generated_at`, `sha256`.
- `segment_embeddings.npz` keys match `corpus.json` track IDs; each value is shape `(num_windows_for_that_track, 512)` and L2-normalized per row.
- `examples.json` carries 3–5 staged precomputed query responses (including both mean-pooled + max-segment similarities).
- Apple stream-not-cache rule respected: no preview audio bytes committed to the repo.

**Risk notes:** iTunes Search API soft limit ~20/min — batch with sleep. Apple Search API terms must be respected (stream-not-cache + attribution). `segment_embeddings.npz` size — at ~6 segments × 512 floats × 500 tracks ≈ 6 MB, well within repo norms. iTunes `.m4a` previews don't decode through soundfile/librosa directly — needs an `audioread`/CoreAudio fallback (Codex discovered this during implementation; fix is in `rebuild_corpus.py`).

**Dependencies:** none.

**Status (2026-06-10): ✅ Shipped via Codex.** 10 Tier-1 tracks ingested; all fast + slow tests pass. Tier-2 currently empty — see Phase 1.5. Full notes in [IMPLEMENTATION_LOG](IMPLEMENTATION_LOG.md).

---

## Phase 1.5 — Tier-2 source resolution (follow-up)

A small unblock task for Tier-2 that surfaced during Phase 1 implementation. The planned FMA HuggingFace slug (`benjamin-paine/free-music-archive`) is inaccessible from Hub; Codex correctly left Tier-2 empty rather than guess. Resolving this brings the catalog from 10 tracks to ~200–500 (the locked target).

**Objective:** `manifest.json` reports `tier_counts.tier2 >= 100`.

**Deliverables:**

- Update `backend/backend/scripts/_fma_loader.py` and/or `_jamendo_loader.py` to point at a working data source. Try in this order:
  1. Verified HF dataset slugs (`mteb/fma_small`, `lewtun/music_genres_small`, or whatever current Hub search surfaces).
  2. Direct download from FMA Small Zenodo / Internet-Archive mirror via `httpx`.
  3. Swap to MTG-Jamendo via direct CDN (`https://mp3l.jamendo.com/?trackid={id}`).
- Re-run `python -m backend.scripts.rebuild_corpus`.

**Acceptance criteria:**

- `manifest.json.tier_counts.tier2 >= 100`.
- All existing fast + slow tests still pass.
- Tier-2 rows carry `license_short` + `source_url` (existing tests enforce).

**Risk notes:** None — narrow fix.

**Dependencies:** Phase 1.

**Suggested execution:** small Codex handoff prompt, can run in parallel with Phase 2.

---

## Phase 2 — Backend updates (similarity API)

Wire the existing `/neighbors` endpoint to the locked protocols.

**Objective:** Backend computes both `meanPooledSimilarity` and `maxSegmentSimilarity` per neighbor, exposes `model_sha`, implements the 10s windowed mean-pool at query time.

**Deliverables:**

- Update `backend/backend/clap_engine.py` for windowed encoding (10s windows over max 90s of query audio).
- Update `backend/backend/api.py` `/neighbors` response shape to include both similarity metrics + `model_sha`.
- Update `backend/backend/config.py` for CLAP `revision=` SHA pin.
- Keep `/analyze` working unchanged for the quality badge.

**Acceptance criteria:**

- `curl POST /neighbors -F file=@track.mp3` returns top-3 with both `meanPooledSimilarity` and `maxSegmentSimilarity` per neighbor, plus `model_sha` at the top level.
- `/analyze` still returns the legacy 7-signal report.
- **Windowing unit tests:**
  - 10s input → exactly 1 window; pooled output equals the direct single-window CLAP encode within float tolerance.
  - 30s input → exactly 3 windows; pooled output is the L2-normalized mean of the per-window vectors.
  - Output vector is always L2-normalized regardless of window count.
- `maxSegmentSimilarity` is computed as: for each catalog track, max over (query_window_i · catalog_window_j) across all i, j.

**Risk notes:** Backwards-compat with `/analyze`. CLAP cold-load on HF Space ~30s — keep startup lifespan logic intact.

**Dependencies:** Phase 1.

---

## Phase 3 — Frontend rewire (similarity-first UI)

Drop the verdict chip. Lead with top-3 by similarity %. "Completely unique" empty state. Quality demoted to inline status badge.

**Objective:** Visible product matches the LOCKED_DECISIONS product shape.

**Deliverables:**

- `quality-scorer/src/lib/api.js` — add `neighborsUpload(file, k)`.
- `quality-scorer/src/components/SimilarityReport.jsx` — new component: top-3 ranked + Case A / Case B empty-state.
- `quality-scorer/src/components/QualityBadge.jsx` — new inline badge with expandable details.
- `quality-scorer/src/pages/ScorerPage.jsx` — rewrite headline copy, flow uses `neighborsUpload` not `analyzeUpload`.
- `quality-scorer/src/components/ReportCard.jsx` — restructured (similarity-first, quality demoted to badge, ACRCloud row slots).
- `quality-scorer/src/components/SunoPill.jsx` — small Suno-flare pill rendered inside the AI Music Detector row when `likely_source === "suno"`. Reserved for that single case; never the headline. Uses `--suno`/`--suno-soft`/`--suno-deep` tokens defined in the Tailwind theme.
- Tailwind theme additions for the Suno-flare palette (warm-rose echoes the Suno Feels-Like-rebrand without overwriting PiedPiper green identity): `--suno: #F25C54`, `--suno-soft: rgba(242,92,84,0.10)`, `--suno-deep: #B8403A`. Used by `SunoPill.jsx` and the small footer detector-sigil row.
- Design reference: see [`factory/artifacts/ui_mockup_v2_suno_flare.html`](ui_mockup_v2_suno_flare.html) for the locked HTML mockup with Suno flare applied. Convert the component shapes from that mockup verbatim.

**Acceptance criteria:**

- Dropping an mp3 yields a ReportCard with top-3 ranked descending by similarity %.
- When the top match's mean-pooled cosine is below the threshold, the headline reads exactly: `"Completely unique — this track doesn't sound like anything in our reference catalog"`.
- Quality status appears inline; click expands to the legacy 7-signal breakdown.
- No multi-band chip text (`near-duplicate` / `similar` / `related` / `unique`) appears anywhere in the UI.

**Risk notes:** Existing Waveform / ScoreDial components may need to move or be deprecated.

**Dependencies:** Phase 2.

---

## Phase 4 — PiedPiper rename + rights documentation (credibility)

Naming and documentation that earn the warm-intro read.

**Objective:** No "Soundcheck" appears in user-visible places. Top-level README documents the catalog rights story explicitly.

**Deliverables:**

- `quality-scorer/index.html` — `<title>` update.
- `quality-scorer/README.md` — full rewrite for PiedPiper framing.
- `backend/backend/api.py:99` — `FastAPI(title="PiedPiper", ...)`.
- `quality-scorer/src/components/Layout.jsx` and `Nav.jsx` — header copy.
- New top-level `README.md` — architecture overview, rights section (catalog tier split, Apple attribution rule, FMA/Jamendo license note, "demo set, not production catalog" caveat), "what I deliberately left out" section.
- **Stale canonical doc reconciliation** — `factory/artifacts/PROBLEM_SUMMARY.md` predates the chip removal + ACRCloud reframe. Either bring it in line with LOCKED_DECISIONS, or add a clear `> Superseded by LOCKED_DECISIONS.md on 2026-06-09 — see that file for current scope.` banner at the top. (Not a build blocker per Codex; rolled into Phase 4 because the doc-cleanup work is already here.)

**Acceptance criteria:**

- `grep -ri "soundcheck" quality-scorer/src quality-scorer/index.html quality-scorer/README.md` returns no user-facing hits (internal-subsystem references OK if explained).
- `README.md` includes a `Rights and catalog` section.
- README walks a 5–20 minute warm-intro reader through architecture + trade-offs + what was deliberately left out.
- `PROBLEM_SUMMARY.md` either reflects the locked product shape or carries the explicit "Superseded" banner pointing at `LOCKED_DECISIONS.md`.

**Risk notes:** None.

**Dependencies:** none (parallelizable with Phase 3).

---

## Phase 5 — ACRCloud integration (P1 #9a + #9b)

Cover Song ID + AI Music Detector as independent ReportCard rows behind a feature flag.

**Objective:** Both ACRCloud signals callable behind `ENABLE_ACRCLOUD=true`. Pre-cached responses for example-chip results and eval-page corpus examples. Trial-window live calls; graceful degradation after expiration.

**Deliverables:**

- `backend/backend/acrcloud_engine.py` — Cover Song ID + AI Music Detector clients with the normalized dual-payload adapter shape from LOCKED_DECISIONS.
- `backend/backend/api.py` — `/neighbors` extended with `acrcloud.coverSongId` and `acrcloud.aiMusicDetector` fields when flag enabled.
- Update `examples.json` and any cached eval responses to include ACRCloud payloads.
- `quality-scorer/src/components/AcrCloudRow.jsx` — renders both signal rows independently.
- Graceful-degradation copy for post-trial state.

**Acceptance criteria:**

- With flag enabled + valid creds, live upload returns both signals end to end.
- With flag disabled (post-trial), example chips still display cached signals; live uploads display `"Signal unavailable in public demo — cached results visible on examples"`.
- ACRCloud credentials never appear in client bundle (`grep -r ACR.*KEY quality-scorer/src` clean).

**Risk notes:** Trial expiration timing must align with demo distribution to Suno. Secrets server-side only.

**Dependencies:** Phases 2 + 3.

---

## Phase 6 — Eval pipeline + eval page (the substance)

The credibility-mover. Named FP/FN examples carry more weight than another metric.

**Objective:** Real eval against ~80-track golden set: 30 seed songs × 2 Suno generations + 20–30 unrelated negatives. Eval page surfaces R@1, R@3, MRR, negatives histogram, and 5+5 named FP/FN examples with audio playback.

**Deliverables:**

- `scripts/build_golden_set.py` — protocol for generating Suno tracks targeting seed songs + collecting negatives.
- `scripts/run_eval.py` — computes R@1, R@3, MRR + top-1 cosine histogram on negatives + per-signal observed behavior for ACRCloud rows.
- `quality-scorer/public/corpus/eval.json` + `golden_set.json` committed.
- Curated 5+5 named FP / FN examples with one-sentence "why this happened" notes.
- `quality-scorer/src/pages/EvaluationPage.jsx` — rewrite: drop confusion matrix; add metric cards, histogram chart, named-example carousel with audio playback, limitations paragraph.

**Acceptance criteria:**

- `/evaluation` page loads real metrics from `eval.json`.
- Each named FP/FN row has audio playback for both query and retrieved track.
- Limitations paragraph names catalog size, single-generator restriction, no inter-rater agreement, US-pop bias.

**Risk notes:** Generating 60 Suno tracks ≈ $20–40 in Suno credits + 3–4 hours of work. Hand-labeling another 2–3 hours.

**Dependencies:** Phases 1 + 3 are hard dependencies (retrieval eval needs catalog + frontend). **Phase 5 is optional** — if ACRCloud is wired by the time Phase 6 runs, the eval includes per-signal observed behavior; if not, the retrieval-only metrics (R@1, R@3, MRR, negatives histogram, named FP/FN) ship without the ACRCloud row and Phase 6 still completes.

---

## Phase 7 — CI + deploy + ship polish (operational)

Audit-grade reproducibility and clean production deploy.

**Objective:** GitHub Actions runs tests + eval-diff check; HF Space + Vercel deploys verified; UptimeRobot ping wired.

**Deliverables:**

- `.github/workflows/test.yml` — unit + contract tests on every push.
- `.github/workflows/eval-check.yml` — re-runs `scripts/run_eval.py` and fails the build if `eval.json` differs from committed when corpus/eval files touched in PR.
- `deploy/hf_space/` updates — PiedPiper rename, ACRCloud env vars, healthcheck.
- Vercel project config — env vars, build settings, cache headers per LOCKED_DECISIONS.
- README documents UptimeRobot ping setup + Modal-fallback note (not implemented).

**Acceptance criteria:**

- Push to main → CI green.
- HF Space deploys; `/health` returns `{ok: true, corpus: <N>}` with N≥200.
- Vercel deploy serves the static frontend, lazy-loads `corpus.json` only on the eval page.
- UptimeRobot ping configured (documented; user wires it post-handoff).

**Risk notes:** HF Space cold-start may need realistic load testing.

**Dependencies:** Phases 1–6.

---

## Done definition

Implementation phase is complete when:

1. All 7 phases' acceptance criteria pass.
2. The deployed URL serves the similarity-first PiedPiper experience end to end.
3. The eval page shows real numbers, real named examples, and an honest limitations paragraph.
4. README walks a warm-intro reader from "what is this" → "how does it work" → "what does it not cover" in one read.
5. CI is green and reproducible.

At that point, the Project Factory orchestrator transitions to the Review → Test-QA → Ship phases.
