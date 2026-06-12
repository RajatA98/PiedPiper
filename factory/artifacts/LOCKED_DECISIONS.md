---
name: LOCKED_DECISIONS
description: Execution-ready locked decisions for PiedPiper — consolidates PROBLEM_SUMMARY / PRD / PRESEARCH into one reference for the Implementation phase
status: Complete
last_updated: 2026-06-09
---

# Locked Decisions — PiedPiper

This document is the contract the Implementation phase treats as fixed. Anything not locked here is either deferred-to-implementation (small) or out of scope (large).

Sourced from: [PROBLEM_SUMMARY](PROBLEM_SUMMARY.md), [PRD](PRD.md), [PRESEARCH](PRESEARCH.md). When this file conflicts with a source, this file wins.

---

## Product shape

- **Headline product:** upload an AI-generated music track → **top 3 closest real songs from the reference catalog, ranked highest similarity first, each with a similarity percentage.**
- **Empty-match state:** when the top match's cosine similarity is below the calibrated cutoff, the headline shows **"Completely unique — this track doesn't sound like anything in our reference catalog."** The top 3 still appear underneath in muted "for reference" styling.
- **No verdict chip.** No `near-duplicate` / `similar` / `related` / `unique` labels. The percentage is the answer.
- **Secondary capabilities on the same ReportCard, as independent rows:**
  - ACRCloud Cover Song ID — match / no-match + confidence
  - ACRCloud AI Music Detector — `ai_probability` + `likely_source`
  - Inherited quality status badge — `Track quality: ok` / `issues detected — click to expand`

## Audience

- **Real reader:** Head of Engineering at Suno, reached via warm-intro from the user's friend, expected to spend 5–20 minutes substantively reviewing the project alongside the resume.
- **Framing-device reader:** platform-side operators (ML Eval, T&S, Platform Engineering) — not the actual reader, but the mental model the README invites.
- **Do not tailor the project to a specific role.** Head of Eng routes via standard interview.

## Stack — frontend

- **React + Vite**, deployed on **Vercel** (Hobby plan, free tier).
- Cache headers: `Cache-Control: public, max-age=31536000, immutable` on hashed-filename assets; normal cache on `corpus.json`; lazy-load `corpus.json` only when the eval page mounts.

## Stack — backend

- **FastAPI** on **Hugging Face Space, CPU Basic** (free tier, 2 vCPU / 16 GB, sleeps after 48 h).
- **UptimeRobot ping** (or GitHub Actions cron) hitting `/health` daily to mitigate sleep.
- README documents **Modal** as a tested fallback for if HF cold-starts become a problem (not implemented in v1).

## Stack — data persistence

- **None.** Stateless demo. Uploaded audio not stored after the request returns. No database. No accounts.

## Catalog

- **Two-tier corpus, ~300–500 tracks total:**
  - **Tier 1 — ~100 recognizable tracks** via the **iTunes Search API `previewUrl`** (no auth, 30 s AAC). Hand-curated for genre coverage.
  - **Tier 2 — ~200–400 breadth tracks** from **FMA** and/or **MTG-Jamendo** (Creative Commons licensed).
- **Apple compliance — non-negotiable:**
  - Preview audio is fetched only at ingest time to compute the embedding, then discarded. Never re-hosted.
  - UI shows Apple/iTunes attribution and a link-out (`trackViewUrl`) on every Tier-1 match.
- **UI/README language:** "demo reference catalog (~100 recognizable + ~200–400 Creative Commons)" — never "real popular music," never "Spotify catalog."

## Catalog freshness

- **Static commit-time artifact.** Four files committed to `quality-scorer/public/corpus/`:
  - `corpus.json` — track metadata (id, title, artist, source, license, sourceUrl, externalIds, attributionRequired)
  - `embeddings.npy` — L2-normalized float32, shape `(N, 512)`
  - `manifest.json` — `{model_id, model_sha, embedding_dim, source_dataset, build_command, generated_at, sha256}`
  - `examples.json` — 3–5 precomputed example query results
- One `scripts/rebuild_corpus.py` CLI rebuilds everything. No live-ingest endpoint.
- CLAP `revision=` SHA pinned in code so re-runs are byte-identical.

## Audio embedding model

- **LAION-CLAP music-tuned 512-d** (`laion/larger_clap_music`). Apache-2.0.
- Pin the HF revision SHA in `requirements.txt` / `from_pretrained(..., revision=...)`.
- Document in README that MERT, MuQ-MuLan, OpenL3, AST were considered and rejected (CPU latency, music-tuning, text-alignment trade-offs).

## Vector search

- **In-memory NumPy cosine sweep** against the L2-normalized corpus matrix.
- One-line code comment: `# Linear sweep is correct here through ~10k vectors. Swap to FAISS Flat if N>10k.`

## Track-length normalization (binding)

- **Catalog previews (30 s):** split into 10 s windows, embed each, mean-pool to a single track vector.
- **Uploaded queries (Suno, 2–4 min):** 10 s windows over max 90 s of audio, evenly spaced or center-biased, embed each, mean-pool.
- **Similarity output:** report **both `max segment similarity` and `mean pooled similarity`** in the response. The headline ranking uses mean pooled; max segment is shown as a secondary metric and surfaces local resemblance.
- Never compare one arbitrary full-track truncation to a 30 s preview embedding.

## Similarity threshold

- **Single threshold only:** the "Completely unique" cutoff.
- **Provisional value: `0.70`** (carry-over). Marked in code as `# CARRY-OVER, no published CLAP-512 threshold data — recalibrate from negatives distribution`.
- **Recalibrate** from the top-1 cosine score distribution on the unrelated negatives in the golden set. Justify the chosen cutoff on the eval page.

## ACRCloud — Cover Song ID (P1 #9a)

- Runs as an **independent row** on the ReportCard.
- Response normalized via the adapter shape locked in PRESEARCH Q10.
- ACRCloud credentials **server-side only** — frontend never sees them.

## ACRCloud — AI Music Detector (P1 #9b) — locked here

- **Decision: ships in P1, runs live during the 14-day ACRCloud free-trial window, with pre-cached responses for all eval-page corpus examples and example-chip results.**
- **After trial expires:**
  - Example chips continue to show the cached AI Music Detector signal (consistent, demo never breaks).
  - Live uploads gracefully degrade: the AI Music Detector row shows `Signal unavailable in public demo — cached results visible on examples.` Other signals (CLAP similarity, Cover Song ID if budget allows, quality badge) keep working.
  - README documents this honestly.
- **Why this approach (over "always-on paid" or "trial-only no-cache"):**
  - Preserves $0 steady-state cost
  - Demo never fully breaks for a reviewer who clicks through later
  - The pre-cached examples carry the "I built this with AI Music Detector" credibility line forever
  - Honest about the trial-gated nature in the README

## Quality status badge (secondary)

- Inherited broken-output detector from prior Soundcheck work.
- Runs in the **same decode pass** as the CLAP encoder — no extra latency.
- Surfaces as a **one-line inline badge**: `Track quality: ok` / `Track quality: issues detected — click to expand`.
- Expanding shows the legacy 7-signal breakdown (silence, clipping, noise, truncation, etc.).
- Quality gets its own short eval section on the eval page (2 paragraphs).

## Eval methodology

- **Single retrieval eval. No verdict eval.** (There's no verdict to evaluate.)
- **Golden set:** 30 hand-picked seed songs from the catalog × 2 Suno generations each (=60 queries) + 20–30 unrelated negatives = **~80 tracks total**.
- **Metrics on the eval page:**
  - `Recall@1`, `Recall@3`, `MRR`
  - Top-1 cosine score histogram on the negatives (shows the noise floor; justifies the threshold)
  - Per-signal observed behavior for each ACRCloud signal (match/no-match rate, timeout/quota rate, observed disagreement examples vs. CLAP)
- **The credibility-mover:** **≥5 named false-positive examples + ≥5 named false-negative examples** on the eval page with audio playback (query + retrieved track) and a one-sentence "why this happened" note per example.
- **Limitations paragraph** at the bottom of the eval page: catalog size, single-generator (Suno only), no inter-rater agreement, US-pop bias.

## Failure UI

- Plain-language copy + small technical error code in muted text next to it.
- Specific copy locked in PRESEARCH Q5.
- "Completely unique" is **not a failure state** — it's a valid empty-match result. The result-card shows the headline copy and the muted "for reference" top-3.

## Example chips

- **Hybrid:** chips load precomputed results instantly from `examples.json` AND offer a `Rerun analysis` button per chip that runs the live pipeline.
- Each chip labeled `example (cached)` so users know what they're seeing.
- Wall-clock latency shown under live-run results (`processed in 4.2s`).
- One-time "Waking up the model…" banner if first cold response runs >6 s.

## CI / build

- Commit to repo: `corpus.json`, `embeddings.npy`, `manifest.json`, `examples.json`, `eval.json`, `golden_set.json`.
- **GitHub Actions:**
  - Every push: unit tests + frontend/backend contract tests (no CLAP required for these).
  - PR-touches `eval.json` or `corpus.*`: re-run `scripts/run_eval.py` and fail the build if `eval.json` differs from committed (forces author to re-run + commit).
  - Manual / scheduled: full corpus rebuild (`scripts/rebuild_corpus.py`).
- Every artifact header includes `{"model_sha": "...", "generated_at": "...", "sha256": "..."}`.

## Rights documentation (P0)

- README explicitly documents:
  - The catalog split (recognizable demo tier vs Creative Commons breadth tier)
  - Apple / iTunes attribution + stream-not-cache rule
  - FMA / MTG-Jamendo license under which CC tracks are used
  - The "this is a sampled demo set, not a production catalog" caveat
  - "Productionizing this would require indexing a licensed catalog" honesty note

## README / about page

- Walks the reader through: architecture, why each technical choice was made, threshold calibration methodology, eval results summary, "what I deliberately left out and why" section.
- Written to be read once by Suno's Head of Eng, not to be SEO copy.
- Takes strong, defensible opinions. Avoids "copyright detector" framing.

## Cost discipline

- **$0 steady-state.** Vercel free + HF Space CPU Basic free + GitHub Actions free.
- **ACRCloud during trial only** (live calls), with cached responses preserving demo integrity after expiration. No paid contracts entered.

---

## Decisions deferred to Implementation phase

These are real choices but they don't affect the architecture; they get resolved during code:

- Exact `catalog.yaml` track list for Tier 1 hand-curation
- Exact wording of inline `borderline` / `for reference` copy on the ReportCard
- Mermaid diagram aesthetic in the README
- Decision on `?format=json` debug endpoint scope
- Whether to expose `model_sha` in `/neighbors` response (recommendation: yes — costs nothing)

## Decisions deferred to a future major version

- ACRCloud always-on (paid plan)
- Calibrated-from-data thresholds replacing carry-over
- Cover Song ID retired if observed false-negative rate is too high after eval
- FAISS / HNSW migration (only at N > 10k tracks)
- Modal migration of backend (only if HF cold-starts become unacceptable)
- Multi-generator eval (Udio, Sonauto, etc.)

## Alternatives explicitly rejected (with reason)

- **Multi-band verdict chip** (`unique` / `related` / `similar` / `near-duplicate`) — rejected 2026-06-09. The percentage is the honest answer; the chip was a derived interpretation that invited "what does 'similar' mean?" debate. See PRESEARCH Decision #1.
- **Spotify previews as Tier 1 source** — rejected 2026-06-04. `preview_url` removed for new apps Nov 27, 2024. iTunes Search API is the practical replacement.
- **ACRCloud Cover Song ID as a "second opinion" with agreement metric** — rejected 2026-06-05 (Codex tightening) and reinforced 2026-06-09 (chip removal). Cover Song ID and the self-built CLAP retrieval answer different questions; composing them into one verdict misrepresents both.
- **MERT or MuQ-MuLan as the audio embedding model** — rejected. CPU latency on free-tier hosting, no text-alignment optionality, marginal embedding-quality gain for this task. See PRESEARCH Q8.
- **FAISS / HNSW at v1** — rejected. NumPy cosine sweep is sub-millisecond at 500 tracks; approximate indexes only become correct at N > 10k.
- **Live ACRCloud calls after trial** — rejected. Breaks $0 cost story; pre-cached examples preserve the demo's credibility line indefinitely.
- **Role-tailored framing** — rejected 2026-06-04. The Head of Eng routes via standard interview; the project just needs to make "this person is worth interviewing" land.
- **Generic broad "AI-music portfolio piece" framing** — rejected. Single-target career bid (Suno specifically) shapes scope.
