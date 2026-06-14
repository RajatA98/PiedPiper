# Codex notes for Claude: MuQ-MuLan matching and percentage display

Date: 2026-06-14

## Bottom line

The app is now using `OpenMuQ/MuQ-MuLan-large` for the runtime audio embedding path, even though several files and UI strings still say "CLAP". The matching math is basically correct for a MuQ-MuLan-style joint embedding system: encode audio windows, L2-normalize vectors, rank catalog tracks by dot product / cosine, and expose both whole-track and segment-level similarity.

The frontend risk is not the nearest-neighbor math. The risk is display semantics: raw cosine times 100 is not a literal "percent similar" and should not be presented as a calibrated copyright percentage. Prefer the calibrated percentile/label fields the backend now returns.

## What the current app does

Backend files to read:

- `backend/backend/config.py`
  - `AUDIO_ENCODER_MODEL_ID = "OpenMuQ/MuQ-MuLan-large"`
  - `AUDIO_ENCODER_SAMPLE_RATE = 24000`
  - `AUDIO_ENCODER_EMBED_DIM = 512`
  - Old `CLAP_*` names are aliases for compatibility.

- `backend/backend/muq_engine.py`
  - Loads `MuQMuLan.from_pretrained(config.AUDIO_ENCODER_MODEL_ID)`.
  - Resamples query audio to 24 kHz.
  - Calls `_model(wavs=wavs)`.
  - Converts the embedding to float32 and L2-normalizes defensively.

- `backend/backend/clap_windowed.py`
  - Despite the filename, this delegates to `muq_engine`.
  - Splits audio into 10 s non-overlapping windows.
  - Encodes each window.
  - Returns:
    - `mean_pooled`: L2-normalized arithmetic mean of window embeddings.
    - `segment_embeddings`: per-window L2-normalized rows.

- `backend/backend/similarity.py`
  - `meanPooledSimilarity = catalog.means @ query_mean`.
  - `maxSegmentSimilarity = max(query_segments @ catalog_segments.T)` per track.
  - Ranking is by `meanPooledSimilarity` only.
  - `maxSegmentSimilarity` is secondary local support, not the sort key.
  - `cosine_to_percentile()` maps a raw cosine into the catalog pairwise-cosine distribution.

- `backend/backend/api.py`
  - Adds each neighbor:
    - `rawCosine`
    - `percentileRank`
    - `similarityLabel`
    - `segmentSupport`
    - `calibratedScore`
    - `matchTimestamp`
  - Top-level fields:
    - `topMeanPooledSimilarity`
    - `topMaxSegmentSimilarity`
    - `topPercentileRank`
    - `topSimilarityLabel`
    - `querySpecificity`

Current corpus manifest confirms the generated catalog is MuQ-MuLan-backed:

```json
{
  "model_id": "OpenMuQ/MuQ-MuLan-large",
  "model_sha": "2e01c796b71dca71b45251384c04cd7b237c9020",
  "embedding_dim": 512,
  "window_seconds": 10,
  "pooling": "l2_normalized_mean"
}
```

## Quick research check

Primary sources:

- Tencent AI Lab's MuQ repo says MuQ-MuLan is a CLIP-like music/text model trained by contrastive learning and jointly represents music and text as embeddings: https://github.com/tencent-ailab/MuQ
- The same repo's usage example loads audio at `sr = 24000`, calls `MuQMuLan.from_pretrained("OpenMuQ/MuQ-MuLan-large")`, obtains `audio_embeds = mulan(wavs=wavs)`, obtains `text_embeds = mulan(texts=texts)`, and calculates similarity with `mulan.calc_similarity(audio_embeds, text_embeds)`: https://github.com/tencent-ailab/MuQ
- The Hugging Face model card repeats the same usage and identifies the weights as `OpenMuQ/MuQ-MuLan-large`: https://huggingface.co/OpenMuQ/MuQ-MuLan-large
- The MuQ paper describes MuQ-MuLan as a joint music-text embedding model based on contrastive learning and reports SOTA zero-shot music-tagging performance on MagnaTagATune: https://arxiv.org/abs/2501.01108
- The source code config uses `sr = 24000`, `clip_secs = 10`, and `dim_latent = 512`; `calc_similarity()` is dot product/einsum. The forward path notes audio longer than 10 s is split into clips and averaged: https://github.com/tencent-ailab/MuQ/blob/main/src/muq/muq_mulan/muq_mulan.py

Interpretation for PiedPiper:

- 24 kHz input is correct.
- 512-d embeddings are correct.
- Dot product is the intended similarity primitive.
- Dot product is equivalent to cosine only when vectors are L2-normalized. The backend normalizes, and corpus tests enforce normalization, so the app's cosine sweep is defensible.
- MuQ-MuLan already chunks long audio internally into 10 s clips and averages. PiedPiper's external 10 s windows are still useful because we need per-window `maxSegmentSimilarity` and timestamps, but do not describe this as "one native full-track MuQ score."

## Correct display semantics for Claude

Use this mapping in frontend copy and components:

| Backend field | Meaning | Frontend use |
| --- | --- | --- |
| `meanPooledSimilarity` / `rawCosine` | Raw dot product/cosine between L2-normalized pooled embeddings | Debug/detail text, bar width if needed, threshold gate |
| `maxSegmentSimilarity` / `segmentSupport` | Strongest 10 s query-window vs catalog-window cosine | Secondary support/detail, timestamp explanation |
| `percentileRank` / `topPercentileRank` | Where the raw cosine lands versus catalog-vs-catalog cosine distribution | Primary "percentage-like" display |
| `similarityLabel` / `topSimilarityLabel` | Coarse label derived from percentile rank: weak/moderate/close/very close | Headline label |
| `calibratedScore` | Same calibrated 0-1 value as percentile for UI meter use | Visual meter only |
| `thresholdDefault` | Raw-cosine cutoff for "Completely unique" state | Case A vs Case B gate |

Recommended headline behavior:

- If `topMeanPooledSimilarity < thresholdDefault`: show the locked empty state.
- If `topMeanPooledSimilarity >= thresholdDefault` and calibrated fields exist: show `Very close`, `Close`, etc. plus `99th percentile match`.
- Show raw cosine in small technical detail: `cosine 0.873`, not as `87.3% similar`.
- If calibrated fields are missing because an old backend is running, only then fall back to legacy raw-cosine percent.

Avoid these phrasings:

- "87% copyrighted"
- "87% infringing"
- "87% copied"
- "87% probability of infringement"
- "MuQ says this is 87% similar"

Better phrasing:

- "Very close - 99th percentile match"
- "Raw cosine 0.873"
- "Strongest 10 s segment match: query 0:20-0:30 vs track 0:10-0:20"
- "Closest tracks in the reference catalog"

## Frontend spots that need Claude attention

1. `quality-scorer/src/pages/ScorerPage.jsx`
   - Still says `embedding via CLAP + cosine sweep`.
   - Change to `embedding via MuQ-MuLan + cosine sweep` or just `embedding audio + searching the catalog`.

2. `quality-scorer/src/pages/AboutPage.jsx`
   - Still says LAION-CLAP in the explanatory copy.
   - Update to MuQ-MuLan and mention 24 kHz / 512-d only if it fits the page.

3. `quality-scorer/src/pages/EvaluationPage.jsx`
   - Methodology text still says CLAP embedding.
   - Update to MuQ-MuLan embedding.

4. `quality-scorer/src/lib/api.js`
   - Comments still describe `modelSha` as "pinned CLAP revision".
   - The logic is mostly right after ADR-0001: `deriveHeadline()` gates on raw cosine but returns calibrated display fields.
   - Consider renaming `topPct` in comments only. It is a legacy alias for raw cosine percent and should not be used as the primary display when percentile fields exist.

5. `quality-scorer/src/components/SimilarityReport.jsx`
   - Current calibrated headline approach is directionally right.
   - Keep raw cosine small.
   - Do not resurrect the old giant raw percent headline unless backend calibration fields are absent.

6. `quality-scorer/src/components/SimilarityRow.jsx`
   - Current row shows percentile and raw cosine tooltip/detail.
   - Bar width using raw cosine is acceptable as a visual spread device, but the label should remain percentile/label-first.

## Sanity checks Claude should preserve

- Top-3 order must match backend order. Do not re-sort in React by percentile, segment score, label, title, or artwork availability.
- Case A/B gate should use raw `topMeanPooledSimilarity >= thresholdDefault`, because the backend threshold is still raw cosine.
- Display interpretation should use `similarityLabel` + `percentileRank` when present.
- Segment score should never outrank mean-pooled score; it explains local resemblance only.
- Raw cosine should be shown with decimals (`0.873`), not converted to a legal or copyright percentage.
- Any user-facing "CLAP" copy should be replaced or generalized, because the current manifest is MuQ-MuLan.

## One nuance worth knowing

MuQ-MuLan's own forward path handles audio longer than 10 seconds by splitting it into 10-second clips and averaging internally. PiedPiper also externally chunks into 10-second windows before calling the model. That is not a blocker because it gives the app explicit per-window embeddings and timestamps, but the product copy should describe our pipeline as "windowed MuQ-MuLan embeddings with pooled retrieval plus segment support," not as a single opaque native model score.
