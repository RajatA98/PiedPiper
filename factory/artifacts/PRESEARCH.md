---
name: PRESEARCH
description: Finalized Presearch for PiedPiper — recommendations distilled from two independent research passes (Claude + Codex) and tightened by Codex's verification notes
status: Complete
last_updated: 2026-06-09
---

# Presearch — PiedPiper

Finalized synthesis of two independent research passes on the [Appendix A questions in the PRD](PRD.md#appendix-a--presearch-outline), tightened by Codex's verification notes:

- [`CLAUDE_PRESEARCH.md`](CLAUDE_PRESEARCH.md) — Claude's pass.
- [`CODEX_PRESEARCH.md`](CODEX_PRESEARCH.md) — Codex's pass, run independently from the [`CODEX_PRESEARCH_PROMPT.md`](CODEX_PRESEARCH_PROMPT.md).
- [`CODEX_TIGHTENING_NOTES_FOR_CLAUDE.md`](CODEX_TIGHTENING_NOTES_FOR_CLAUDE.md) — Codex's verification of the synthesis. Findings applied below; changelog at the bottom.

Human-in-the-loop walkthrough with the user is the gate before this graduates into the Decide phase.

---

## ⚡ Headline cross-pass disagreements (decision-ready)

Four questions had material disagreement between the two passes. They are decided here with explicit reasoning so the build phase has unambiguous direction.

### 1. Threshold model — single threshold ("Completely unique" cutoff), no multi-band chip

- **Claude said:** Shift the 3-band chip thresholds to 0.90/0.78/0.62 based on a blog post.
- **Codex said:** Keep current as provisional, require calibration before changing.
- **User decision (2026-06-09):** Drop the multi-band chip system entirely. The product shows top 3 results sorted by similarity %, highest first, and a "Completely unique" headline when nothing crosses the threshold. **Only ONE threshold remains**: the "Completely unique" cutoff. Current carry-over: `0.70`. Calibrate from the negatives score distribution on the golden set before locking.
  - **Why:** A product that says "87% similar to *Blinding Lights*" is more honest than one that says "the verdict chip is `similar`." The percentage is the answer; the chip was a derived interpretation.

### 2. Catalog source — Claude's iTunes Search API two-tier (verified) + Codex's defensive UI framing + Apple attribution requirement

- **Claude said:** Two-tier: ~60–80 recognizable tracks via the **iTunes Search API `previewUrl`** (no auth, 30s AAC, recognizable catalog, no Spotify-style deprecation) + ~200–400 FMA/MTG-Jamendo tracks for breadth.
- **Codex said:** FMA/MTG-Jamendo only; recognizability layer via paid ACRCloud; UI calls it "demo reference catalog" + "commercial catalog check"; do not promise "real popular music" as P0.
- **Codex tightening (2026-06-05):** ✅ Live-tested iTunes Search API `previewUrl` works without auth. **But:** Apple's Search API terms treat previews as promotional content — must be **streamed not cached as audio bytes**, and the UI must include Apple/iTunes attribution + link-outs to iTunes Store next to any matched track. The indexed artifact is the *embedding* (derived feature, not the audio itself), which keeps us within stream-not-store norms.
- **Decision:** Pursue **Claude's two-tier**, adopt **Codex's defensive UI language**, and add the **Apple attribution + link-out + stream-not-store** rule for any Tier-1 hit. README + chip labels say "demo reference catalog (~60 recognizable + ~400 Creative Commons)" — never "real popular music."

### 3. ACRCloud products — keep BOTH as separate signals (Codex tightening overruled Claude's pivot)

- **Claude said:** Pivot the stretch goal from Cover Song ID to AI Music Detector.
- **Codex said:** Stay with Cover Song ID via Identification API; noted AI Music Detector as a sibling product.
- **Codex tightening (2026-06-05):** ❌ **Reject the pivot — these answer different questions and should NOT be collapsed into one feature.**
  - **AI Music Detector answers:** *"Is this AI-generated, and likely from which engine (Suno / Udio / Sonauto / Mureka / Riffusion)?"*
  - **Cover Song ID answers:** *"Does this resemble a known composition / performance family in the commercial catalog?"*
- **Decision:** Keep BOTH as independent P1 signals on the ReportCard. Cover Song ID is the **similarity second opinion** (paired with our self-built CLAP retrieval as the agreement metric). AI Music Detector is an **independent third signal** ("this looks like Suno output, probability 87%") that sits next to the similarity verdict, not inside it. Split the PRD's P1 #9 into:
  - **P1 #9a — Cover Song ID** as the commercial similarity second opinion.
  - **P1 #9b — AI Music Detector** as a separate "is this AI?" badge.

  Both ride on the same ACRCloud account, so the cost and integration overhead is mostly amortized.

### 4. Eval methodology — retrieval-only (no verdict eval, since there's no verdict)

- **Claude said:** Data-generation protocol (Suno prompts targeting seed songs) + 4-class verdict labels + MAP@5.
- **Codex said:** Recall@1/Recall@3/MRR/MR1/MAP + 4-class verdict labels.
- **User decision (2026-06-09):** With the chip dropped, there is no verdict to evaluate — only retrieval. The eval is significantly simpler:
  - **Golden set:** 30 seed songs × 2 AI generations each (=60 queries) + 20–30 unrelated negatives = ~80 tracks total.
  - **Metrics:** **Recall@1, Recall@3, MRR.** Drop MAP@5 (overkill at N=60, harder to explain). Drop the 4-class confusion matrix entirely.
  - **Supplementary:** Histogram of top-1 cosine scores on the negatives set — shows where the noise floor sits and justifies the "Completely unique" threshold.
  - **The credibility-mover:** ≥5 named false-positive + ≥5 named false-negative examples with audio playback and a one-sentence "why this happened" note. This carries more weight on the eval page than any additional metric.

---

## Per-question synthesized recommendations

### Q1 — Verdict decision tree (now: single-threshold "Completely unique" rule)

**Recommendation:** **Only one threshold remains** — the "Completely unique" cutoff (provisional `0.70`, marked in code as `# CARRY-OVER, no published CLAP-512 threshold data — recalibrate from negatives distribution`). Codex's tightening pass confirmed there is no credible published threshold data for AI-vs-real music similarity in CLAP-512 space; calibration from the project's own negatives distribution is the only defensible source.

**Display rule:**
- IF top-match similarity ≥ threshold → show top 3 results sorted descending, each labeled with its similarity %.
- IF top-match similarity < threshold → show **"Completely unique — no close matches in our catalog"** as headline; the top 3 still appear below in muted "for reference" styling.

See decision #1.

**Citations:** [Cover-song retrieval metrics standard practice](https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-017-0108-2) · [LAION-CLAP music model card](https://huggingface.co/laion/larger_clap_music) · [Stability-AI stable-audio-metrics CLAP score implementation](https://github.com/Stability-AI/stable-audio-metrics/blob/main/src/clap_score.py)

---

### Q2 — Hybrid disagreement handling (now: three independent signal rows, no composite)

**Recommendation:** With the verdict chip dropped, there's nothing to "compose." Show all three signals as **independent rows on the ReportCard**, each in its own visual lane:

1. **Self-built CLAP retrieval** → headline row: top 3 with similarity %, or "Completely unique."
2. **ACRCloud Cover Song ID** → second row: `Cover match: "{song}" by {artist}` with their 70–100 confidence, or `No cover match`.
3. **ACRCloud AI Music Detector** → third row: `AI-generated (87%) — likely Suno` or `Human — likely original`.

The user reads them as three independent answers to three different questions. **No "composite verdict" or "models disagree" affordance is needed**, because none of the rows is trying to overwrite the others.

On the eval page, instead of an agreement metric, report **per-signal accuracy** independently against the golden set. (The Cover Song ID signal will systematically miss most AI soundalikes — that's information, not a bug, and the eval should show it.)

**Citations:** [ACRCloud AI detection — "interpret with other signals"](https://docs.acrcloud.com/faq/ai-music-detection)

---

### Q3 — Catalog freshness

**Recommendation:** Static commit-time artifact. Ship four files in `quality-scorer/public/corpus/`:

- `corpus.json` — track metadata (id, title, artist, source, license, source URL, external IDs)
- `embeddings.npy` — L2-normalized float32, shape `(N, 512)`
- `manifest.json` — `{model_id, model_sha, embedding_dim, source_dataset, build_command, generated_at, sha256}`
- `examples.json` — 3–5 precomputed example query results

One `scripts/rebuild_corpus.py` CLI rebuilds everything. No live-ingest endpoint. Pin the CLAP `revision=` SHA in code so re-runs are byte-identical (per Claude's "Things to flag" #2).

**Citations:** [mdeff/fma static dataset convention](https://github.com/mdeff/fma) · [MTG-Jamendo baseline scripts](https://github.com/MTG/mtg-jamendo-dataset) · [lakeFS — ML reproducibility pillars](https://lakefs.io/blog/ml-reproducibility-pillars/)

---

### Q4 — Eval methodology (retrieval-only, post-chip removal)

**Recommendation:** Single retrieval eval on a single golden set:

- **Golden set:** 30 hand-picked seed songs from the catalog × 2 Suno generations each (=60 queries) + 20–30 unrelated negatives (random AI tracks with no soundalike in catalog) = **~80 tracks total**.
- **Metrics:**
  - **Recall@1** — % of queries where the targeted seed is the #1 result.
  - **Recall@3** — % of queries where the targeted seed appears in the top 3.
  - **MRR** — mean reciprocal rank of the targeted seed across all queries.
  - **Top-1 cosine score histogram on negatives** — shows where the noise floor sits; justifies the `0.70` "Completely unique" cutoff (or whatever the calibration lands on).
- **The credibility-mover (this is what actually convinces a reader):** **≥5 named false-positive + ≥5 named false-negative examples** on the eval page with:
  - Audio playback for both the query AI track and the retrieved/missed catalog track.
  - A one-sentence "why I think this happened" note per example (e.g., "same 80s synthwave palette, same tempo — acoustic similarity is real, copyright similarity is not").
- **Honest limitations paragraph at the bottom of the eval page**: catalog size, single-generator (Suno only), no inter-rater agreement, US-pop bias.

Document the construction protocol *on the eval page* — the protocol-on-display is half the credibility. See decision #4.

**Citations:** [Da-TACOS dataset (ISMIR 2019)](https://archives.ismir.net/ismir2019/paper/000038.pdf) · [Cover Song Identification survey (ACM 2024)](https://dl.acm.org/doi/fullHtml/10.1145/3638884.3638891)

---

### Q5 — Failure surface design

**Recommendation:** Plain-language copy with a small technical code in muted text next to it. Inline result-card replacement for input errors (`unsupported_media`, `decode_failed`, `empty_file`, `file_too_large`, `empty_audio`, `no_corpus`); transient banner for upstream/quota errors (`acrcloud_timeout`, `acrcloud_quota`) so user can retry without re-upload. Preserve file selection on retry. Specific copy:

- `unsupported_media`: "That file type isn't supported. Try MP3, WAV, FLAC, OGG, or M4A."
- `decode_failed`: "We couldn't read that audio. It might be corrupted or unusually encoded — try re-exporting as MP3 or WAV."
- `empty_file`: "That file is empty. Re-upload and try again."
- `file_too_large`: "File is over 50 MB. Trim to a 30–60 second clip — only the first minute is analyzed anyway."
- `no_corpus`: "Reference catalog isn't loaded yet. Refresh the page in a moment."
- `acrcloud_timeout`: banner — "Second-opinion service is slow right now. Showing CLAP result only." (retry button for ACRCloud only)
- `acrcloud_quota`: banner — "Daily quota reached on the second-opinion service. Showing CLAP result only."

**Citations:** [Google Cloud Speech-to-Text error conventions](https://cloud.google.com/speech-to-text/docs/error-messages) · [ACRCloud Identification API request format](https://docs.acrcloud.com/reference/identification-api/identification-api)

---

### Q6 — Example-chip behavior

**Recommendation:** Hybrid. Example chips show **precomputed results instantly** (loaded from `examples.json`) and are visibly labeled `example (cached)`. A "rerun analysis" button per chip runs the live pipeline. Wall-clock latency displayed under each result (`processed in 4.2s`) so cached vs live is unambiguous. One-time "Waking up the model…" banner if first cold response runs >6 s.

**Citations:** [HF Spaces sleep behavior](https://huggingface.co/docs/hub/en/spaces-overview)

---

### Q7 — Reference catalog source

**Recommendation:** Two-tier corpus. See decision #2.

- **Tier 1 — ~60–80 "recognizable" tracks** via iTunes Search API `previewUrl` (no auth, 30s AAC; ✅ verified live 2026-06-05). Hand-pick recognizable hits across genres.
- **Tier 2 — ~200–400 "breadth" tracks** from FMA or MTG-Jamendo (CC-licensed, defensible rights story).
- **Apple compliance:** Tier-1 previews are promotional content per Apple Search API terms. Implement as **stream-not-cache** — fetch the preview at ingest time *only to compute the embedding*, store only the embedding + metadata + the `previewUrl` itself, then never re-host. UI must show Apple/iTunes attribution and link-out to the iTunes Store next to every Tier-1 match.
- **UI/README language:** "demo reference catalog (~60 recognizable hits + ~400 Creative Commons tracks)" — never "real popular music" or "Spotify catalog."
- No source audio shipped in the deployed app — embeddings + metadata + link-outs only.

**Citations:** [Spotify Web API deprecation announcement (Nov 27 2024)](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api) · [FMA paper (arXiv 1612.01840)](https://arxiv.org/abs/1612.01840) · [MTG-Jamendo dataset](https://mtg.github.io/mtg-jamendo-dataset/)

---

### Q8 — Audio embedding model

**Recommendation:** Stay on **LAION-CLAP music-tuned 512-d** (`laion/larger_clap_music`). Pin the `revision=` SHA in code. Document the alternatives considered (MERT, MuQ-MuLan, OpenL3, AST, classical baselines) in the README and explain why CLAP was kept (Apache-2.0, ~190 MB, CPU-friendly ~1–2 s per inference, music-tuned, paired with eval-based calibration). The "considered MERT and rejected on these grounds" sentence in the README *is* the engineering-judgment signal.

**Citations:** [laion/larger_clap_music (Apache-2.0)](https://huggingface.co/laion/larger_clap_music) · [MERT paper (arXiv 2306.00107)](https://arxiv.org/pdf/2306.00107) · [MDPI 2025 CLAP vs MERT on fine-grained music tasks](https://www.mdpi.com/2079-9292/15/8/1723)

---

### Q9 — Vector search method

**Recommendation:** **NumPy cosine sweep**. At 500 × 512-float, a sweep is sub-millisecond. Do not pre-import FAISS. Place a one-line guidepost comment in the search module: `# Linear sweep is correct here through ~10k vectors. Swap to FAISS Flat if N>10k.` Both passes agreed unambiguously.

**Citations:** [FAISS index-selection guidance](https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index)

---

### Q10 — ACRCloud (TWO separate signals; trial-gated)

**Recommendation:** See decision #3. The P1 hybrid is **two independent ACRCloud signals** on the same ReportCard:

- **P1 #9a — Cover Song ID** → the commercial *similarity* second opinion paired with our self-built CLAP retrieval (agreement metric on the eval page).
- **P1 #9b — AI Music Detector** → an independent *"is this AI?"* badge with `ai_probability` and `likely_source` (Suno / Udio / Sonauto / Mureka / Riffusion / ...) next to the verdict.

Both ride on the same account so integration overhead is amortized.

**Cost framing (Codex tightening):** ACRCloud is available through **trial / contact-sales pricing**. Treat as a **budget-gated P1 integration, not a guaranteed free feature.** The "AI Music Detector is free when bundled with Derivative Works Detection" marketing claim is not safe to rely on — Derivative Works Detection itself appears commercial / contact-sales.

**Integration plan:**

- Behind a feature flag `ENABLE_ACRCLOUD=true` during the 14-day free-trial window.
- Pre-cache responses for all eval-page corpus examples so the agreement metric remains computable from static data after the trial expires.
- Normalized JSON adapter — one provider, two payloads:

```json
{
  "provider": "acrcloud",
  "coverSongId": {
    "status": "match|no_match|timeout|quota_exceeded|disabled",
    "title": "...",
    "artist": "...",
    "score": 88,
    "scoreSemantics": "acrcloud_music_confidence_70_100",
    "externalIds": {}
  },
  "aiMusicDetector": {
    "status": "match|no_match|timeout|quota_exceeded|disabled",
    "verdict": "ai_generated|human|no_vocals",
    "ai_probability": 0,
    "likely_source": "suno|udio|sonauto|mureka|riffusion|null",
    "scoreSemantics": "acrcloud_ai_probability"
  }
}
```

- Keep ACRCloud credentials server-side only. Frontend never sees them.

⚠️ Build-phase verification: pricing per request, SLA documentation. Plan to run 20–30 real calls during the trial and document observed behavior in the README.

**Citations:** [ACRCloud AI Music Detector product page](https://www.acrcloud.com/ai-music-detector/) · [ACRCloud AI Music Detection API response schema](https://docs.acrcloud.com/reference/console-api/file-scanning/metadata/ai-music-detection) · [ACRCloud Identification API reference](https://docs.acrcloud.com/reference/identification-api) · [ACRCloud blog — AI Song Detector launch (Jan 2026)](https://www.acrcloud.com/blog/ai-song-detector-supports-suno-udio-elevenlabs-and-more/)

---

### Q11 — Backend hosting

**Recommendation:** **Hugging Face Space CPU Basic** (free, 2 vCPU / 16 GB, sleeps after 48 h). It's the correct cultural signal — Suno engineers know HF Spaces, "this lives on HF" is itself a credibility datum. Mitigate sleep with a UptimeRobot ping (or GitHub Actions cron) hitting `/health` daily. In the README, document Modal as a tested fallback ("warm cold-start ~8 s vs HF's ~60 s — would migrate at >50 RPS"). That paragraph itself is the engineering-judgment signal.

**Citations:** [HF Spaces hardware table — CPU Basic free](https://huggingface.co/docs/hub/en/spaces-overview) · [Modal pricing — $30/mo free credit](https://modal.com/pricing) · [HF Spaces sleep behavior](https://huggingface.co/docs/hub/spaces-gpus)

---

### Q12 — Frontend hosting / CDN

**Recommendation:** **Stay on Vercel**. Both passes agreed. Set `Cache-Control: public, max-age=31536000, immutable` on hashed-filename assets; normal cache headers on `corpus.json`. Lazy-load the corpus JSON only when the eval page mounts — it's not needed for the upload flow. Do not put a Vercel-vs-CF paragraph in the README; nobody at this audience level cares at <1 MB asset size.

**Citations:** [Vercel Hobby plan](https://vercel.com/docs/accounts/plans/hobby) · [Cloudflare Pages Free limits](https://developers.cloudflare.com/pages/platform/limits/)

---

### Q13 — CI / build

**Recommendation:** Commit four artifacts to the repo: `corpus.json`, `embeddings.npy`, `manifest.json`, `examples.json`, `eval.json` (and labeled `golden_set.json`). GitHub Actions runs:

- **Every push:** unit tests + frontend/backend contract tests (no CLAP required).
- **PR-touch on `eval.json` or `corpus.*`:** re-run `scripts/run_eval.py` and fail the build if `eval.json` diff from committed. Forces the author to re-run and commit, audit-grade reproducibility loop.
- **Manual / scheduled:** full corpus rebuild (`scripts/rebuild_corpus.py`).

Every artifact header includes `{"model_sha": "...", "generated_at": "...", "sha256": "..."}`. This single line is what separates "I have an eval" from "I have an audit-grade eval."

**Citations:** [lakeFS — ML reproducibility pillars](https://lakefs.io/blog/ml-reproducibility-pillars/) · [Sachith — evaluating models with golden sets in CI](https://www.sachith.co.uk/evaluating-models-with-golden-sets-performance-tuning-guide-practical-guide-dec-6-2025/)

---

## Things to flag (combined from both passes, deduplicated)

Items neither pass was directly asked about but that materially affect the build or the audience's read:

1. **Revise PRD P0 catalog language.** P0 #2 currently says "≥200 tracks of real popular music." Soften to "≥200 lawfully sourced reference tracks split across recognizable demo tier and Creative Commons breadth tier." Aligns with decision #2.
2. **Pin the CLAP checkpoint commit SHA.** Use `revision=` arg in `from_pretrained`. 30-second fix, huge reproducibility payoff.
3. **The 7s window 10%/45%/80% sampling is folkloric.** Vendor blog claim, not in the CLAP paper. Cite it as a choice, not as canon. Consider documenting an alternative 2s-hop-overlapping sweep for Suno outputs <30 s.
4. **Track length normalization (specific protocol from Codex tightening).** Suno outputs are 2–4 min; iTunes/CC previews are 30 s. Embedding a 30 s window vs a 2-min mean-pool produces meaningfully different vectors. Adopt the segmented-window approach so both sides are comparable:
   - **Catalog previews (30 s):** split into ~10 s windows, embed each window, mean-pool to a single track vector.
   - **Uploaded queries (Suno, 2–4 min):** ~10 s windows over max 90 s of audio, evenly spaced or center-biased, embed each, mean-pool.
   - **Similarity report:** store and surface **both** `max segment similarity` and `mean pooled similarity` — they answer different questions (peak local resemblance vs overall acoustic family).
   - Never compare one arbitrary full-track truncation to a 30 s preview embedding.

   Flag this protocol in the README.
5. **Golden set needs ≥30% unrelated negatives.** AI tracks with no soundalike in the catalog. Without negatives the score-distribution histogram has no noise floor to compare against, and the "Completely unique" threshold can't be calibrated. Already folded into the Q4 recommendation.
6. **Quality scorer needs its own eval section.** It's currently a sidecar in the PRD but a reviewer who values production engineering will want to see it evaluated separately from similarity. Two-paragraph eval section is plenty; just don't leave it implicit.
7. **`/neighbors` response should expose `model_sha`.** Costs nothing, makes every screenshot auditable against the repo SHA.
8. **`?format=json` debug response on the verdict endpoint** returning raw cosine values for top-10 + the threshold table actually used. This is what an engineer reaches for first.
9. **Make rights documentation P0.** README must say exactly what corpus is indexed, what rights exist, what's not covered, how production would differ.
10. **Avoid "copyright detector" language everywhere.** Already in PRD non-goals; flagged here for visibility during implementation.
11. **Add a model-card-style "limitations" section.** Known limitations: genre/style false positives, lyric-insensitive behavior, short-sample sensitivity, catalog incompleteness, threshold calibration weakness.
12. **Keep ACRCloud credentials server-side only.** Frontend should never see ACRCloud secrets; `/neighbors` returns the normalized provider result.

---

## Codex tightening pass — applied 2026-06-05

What Codex verified, what changed, and why. Full notes in [`CODEX_TIGHTENING_NOTES_FOR_CLAUDE.md`](CODEX_TIGHTENING_NOTES_FOR_CLAUDE.md).

- ✅ **iTunes Search API `previewUrl`** — live-tested without auth on 2026-06-05. Decision #2 confirmed; **Apple attribution + stream-not-cache rule added** to Q7 based on Apple Search API terms.
- ❌ **AI Music Detector pivot** — overruled. AI Music Detector and Cover Song ID answer different questions. Decision #3 rewritten to keep **both as independent P1 signals**; PRD's P1 #9 split into 9a (Cover Song ID) and 9b (AI Music Detector). Q10 normalized JSON adapter updated to a two-payload shape.
- ❌ **Free-cost claim** — overruled. ACRCloud bundling claim is not safe to rely on; Derivative Works Detection itself appears commercial. Q10 reframed as **"trial / contact-sales pricing, budget-gated P1, not guaranteed free."**
- ✅ **Threshold provisionality** — confirmed. No published CLAP-512 threshold data; calibration from the project's own distributions is the only defensible source. Q1 wording strengthened.
- ✅ **Metric stack trim** — `MR1` dropped from Q4 (redundant with MRR at N=30–100; less readable for the audience). Stack at that point was `Recall@1`, `Recall@3`, `MRR`, `MAP@5`. (Subsequently trimmed again on 2026-06-09 — see below.)
- ✅ **Track-length normalization** — specific protocol adopted in Things-to-flag #4: 10 s windowed embeddings + mean-pool, report both `max segment similarity` and `mean pooled similarity`.

---

## User human-in-the-loop pass — applied 2026-06-09

Walkthrough with the user during the decide-gate. Product-shape simplification + Codex consistency audit.

- ✅ **Multi-band verdict chip dropped.** User: "order by how closely it matches, highest match on top; if [low] match just say it's completely unique." Decision #1 rewritten to a single-threshold model (only the "Completely unique" cutoff at provisional `0.70`). Q1 display rule and ReportCard layout (PRD Flow 1) updated.
- ✅ **Eval simplified to retrieval-only.** With the chip gone there's no verdict to evaluate. Decision #4 + Q4 rewritten. Final metric stack: **`Recall@1`, `Recall@3`, `MRR`** + top-1 cosine histogram on negatives. **`MAP@5` dropped** (overkill at N=60, harder to explain). 4-class verdict labels + confusion matrix removed entirely. Named FP/FN examples (≥5 each) elevated as the credibility-mover.
- ✅ **ACRCloud framing simplified.** Q2 rewritten — both signals (Cover Song ID + AI Music Detector) shown as independent rows on the ReportCard, no composite verdict, no "agreement metric." Per-signal observed behavior on the eval page instead.
- ✅ **Things-to-Flag #5** reworded (was chip-era "verdict eval needs negatives"; now correctly framed as "golden set needs negatives for noise-floor calibration").

## Codex decide-gate consistency audit — applied 2026-06-09

Codex sanity-checked the chip-removal pass before Decide. Verdict: 5 PRD consistency holes I missed. Full notes in [`CODEX_DECIDE_GATE_FEEDBACK_FOR_CLAUDE.md`](CODEX_DECIDE_GATE_FEEDBACK_FOR_CLAUDE.md). Fixes applied:

- ✅ **PRD Goal #4** reframed from "two-system comparison with agreement metric" → "three independent signals on one ReportCard."
- ✅ **PRD Flow 3 (eval page)** — dropped "agreement rate"; reframed as per-signal observed behavior.
- ✅ **PRD P0 #2 (catalog)** — softened "≥200 tracks of real popular music" to "≥200 lawfully sourced reference tracks split across a recognizable demo tier and a Creative Commons breadth tier."
- ✅ **PRD P1 #9 split** into 9a (Cover Song ID) and 9b (AI Music Detector); old #10 ("Agreement metric") replaced with per-signal eval.
- ✅ **Rights documentation moved from P2 to P0.** Codex: "rights are credibility, not polish." Agreed.

Flagged for the Decide phase (not Presearch's job to resolve):

- Decide locks whether **AI Music Detector ships in P1 or stays feature-flagged/trial-gated**.
- Q5 confirmed: no failure-UI variant needed for "Completely unique" — it's an empty-match result, not an error. Decide locks the empty-match UI copy.

The PRESEARCH is now fully finalized. Decide phase follows.
