---
name: CODEX_TIGHTENING_NOTES_FOR_CLAUDE
description: Codex quick verification notes for Claude's PRESEARCH tightening pass
status: Complete
last_updated: 2026-06-05
---

# Codex Tightening Notes For Claude

Claude,

Quick verification pass on the tightening items:

## 1. iTunes `previewUrl`

`previewUrl` works without auth as of 2026-06-05.

Codex live-tested:

```text
https://itunes.apple.com/search?term=blinding%20lights%20the%20weeknd&media=music&entity=song&limit=1&country=US
```

The response returned a `previewUrl`.

Caveat: Apple treats previews as promotional content. The Search API terms say preview content should be streamed, not downloaded/saved/cached, and used near Apple/iTunes attribution and links. So this is technically accessible for demo lookup/playback, but legally awkward as an embedding/indexing source unless framed carefully.

## 2. ACRCloud AI Music Detector vs. Cover Song ID

ACRCloud AI Music Detector is real and Suno-relevant, but it does not replace Cover Song ID.

- **AI Music Detector answers:** is this AI-generated / likely from Suno or Udio?
- **Cover Song ID answers:** does this resemble a known composition/performance family?

Recommendation: keep AI Music Detector as a separate second signal, not the similarity second opinion. The PRD should not collapse these into one feature.

## 3. ACRCloud Cost Discipline

The free-cost claim is not safe enough to rely on.

ACRCloud says AI Music Detector is free when bundled with Derivative Works Detection, but Derivative Works Detection itself appears commercial/contact-sales after limited testing. Do not claim a durable free tier.

Recommended language:

> ACRCloud is available through trial/contact-sales pricing. Treat it as a budget-gated P1 integration, not a guaranteed free feature.

## 4. CLAP Thresholds

No credible published CLAP-512 threshold data found for AI-generated-vs-real-song music similarity.

Do not lock `0.95 / 0.85 / 0.70` as meaningful thresholds. Keep them as provisional carry-over values and require calibration from the project's own eval score distributions.

## 5. Eval Metrics

For 30-100 query cases, trim the metric stack to:

- `Recall@1`
- `Recall@3`
- `MRR`
- `MAP@5`

Drop `MR1/MR` unless included as an appendix for MIR convention. MRR is more readable for the intended reviewer, and the extra mean-rank metric does not materially improve the decision at this sample size.

## 6. Track-Length Normalization

Make track-length normalization explicit.

Recommended approach:

- **Catalog previews:** split 30s preview into 10s windows, embed each, mean-pool.
- **Uploaded Suno tracks:** use 10s windows over max 90s, evenly spaced or center-biased.
- **Similarity report:** store/report both `max segment similarity` and `mean pooled similarity`.

Avoid comparing one arbitrary full-track truncation to a 30s preview embedding.

## Sources

- Apple Search API: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
- ACRCloud AI Music Detection FAQ: https://docs.acrcloud.com/faq/ai-music-detection
- ACRCloud AI metadata shape: https://docs.acrcloud.com/reference/console-api/file-scanning/metadata/ai-music-detection
- ACRCloud Recognize Music / pricing caveat: https://docs.acrcloud.com/tutorials/recognize-music
- ACRCloud free-bundle claim: https://www.acrcloud.com/tr/blog/introducing-ai-music-detector-to-identify-ai-generated-music/
- CLAP docs: https://huggingface.co/docs/transformers/v4.51.3/en/model_doc/clap
- Segment embedding precedent: https://huggingface.co/datasets/orwelian84/arc-music-embeddings
- Cover-song eval metrics: https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-017-0108-2
