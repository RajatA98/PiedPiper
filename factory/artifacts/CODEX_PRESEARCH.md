---
name: PRESEARCH
description: Codex presearch for PiedPiper — technology, catalog, eval, and deployment options for the acoustic-similarity scanner
status: Complete
last_updated: 2026-06-04
---

# Codex Presearch — PiedPiper

## Q1 — Verdict decision tree

### Options considered

- **Keep current fixed thresholds:** `>=0.95 near-duplicate`, `>=0.85 similar`, `>=0.70 related`, otherwise `unique`.
- **Calibrated thresholds:** start with the current cutoffs, then tune from a small labeled set of exact copies, cover/version pairs, AI-generated soundalikes, and unrelated negatives.
- **Rank-only v1:** avoid absolute verdicts and show only top neighbors plus a qualitative caveat.

### Trade-offs

Fixed thresholds are simple and easy to explain, but I found no reliable literature saying those exact cosine bands are meaningful in LAION-CLAP music embedding space for AI-generated-vs-real-song similarity. Cover-song identification literature usually evaluates ranking quality, not universal cosine thresholds. Common metrics include MAP, MRR/MaRR, top-10 hits, and mean rank of first correct match.

Boundary behavior matters. A score of `0.849` should not visually swing from "related" to "similar" with no caveat. Treat bands within about `0.02` of a threshold as low-confidence and show an "edge case" note in the UI or evaluation table.

### Recommendation

Use calibrated thresholds, not fixed inherited thresholds. Keep the current numbers only as provisional defaults, then require a calibration artifact: score distributions for known positives, known covers/soundalikes, and negatives. In the UI, show both the score and the verdict, and mark threshold-edge cases as "borderline."

### Citations

- Cover-song systems commonly evaluate retrieval with MAP/MRR/top-k rather than universal embedding thresholds: https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-017-0108-2
- MIREX-style cover/version work uses mean average precision and mean rank style metrics: https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-023-00297-4
- Covers80 is a paired cover-song benchmark, not a cosine-threshold benchmark: https://labrosa.ee.columbia.edu/projects/coversongs/covers80/

## Q2 — Hybrid disagreement handling

### Options considered

- **Show both systems side-by-side:** CLAP retrieval result and ACRCloud result each get their own status.
- **Conservative aggregate:** if either system flags high risk, headline result becomes "needs review."
- **Weighted ensemble:** combine CLAP similarity and ACRCloud confidence into one score.
- **Hide disagreement:** show only the highest-confidence system.

### Trade-offs

Side-by-side is the most honest for a portfolio artifact because it exposes system behavior and lets the reviewer see your judgment. Conservative aggregation is useful for risk workflows, but it can overstate certainty if ACRCloud is doing cover-song identification while CLAP is doing broad acoustic-neighbor retrieval. A weighted ensemble is premature without enough labeled data to justify weights. Hiding disagreement removes the most interesting engineering signal.

ACRCloud's own AI-detection docs recommend interpreting model outputs with other operational signals and not treating them as the sole basis for high-impact decisions. That same pattern fits this product: disagreement should surface as "investigate," not be collapsed into a fake certainty.

### Recommendation

Show both systems and add a conservative headline state:

- CLAP high + ACRCloud high: `near-duplicate risk`
- CLAP high + ACRCloud no match: `acoustic similarity risk — ACRCloud did not confirm`
- CLAP low + ACRCloud high: `catalog match risk — investigate`
- both low: `no strong match in demo catalog`

Use "investigate" for disagreement. Do not build a weighted ensemble for v1.

### Citations

- ACRCloud says its AI-detection outputs should be interpreted with other contextual/operational signals and not be the sole basis for legal or high-impact decisions: https://docs.acrcloud.com/faq/ai-music-detection
- ACRCloud supports separate audio engines including fingerprinting, cover/humming identification, and AI music detection: https://docs.acrcloud.com/tutorials/recognize-music

## Q3 — Catalog freshness

### Options considered

- **Static commit-time corpus:** checked-in metadata plus `.npy` embeddings built by CLI.
- **Static metadata, generated embeddings on deploy:** build corpus during deployment.
- **Dynamic catalog:** admin flow or scheduled job adds tracks and updates vectors.

### Trade-offs

For 200-500 tracks, static commit-time artifacts are the right default. They are reproducible, reviewable, and cheap. Dynamic freshness adds operational complexity that does not help the Suno review goal. If the CLAP checkpoint changes, the full corpus must be re-embedded because vector spaces are not comparable across model/checkpoint changes.

The important workflow is not "freshness"; it is "rebuildability." A reviewer should be able to see `catalog.json`, `embeddings.npy`, `model_id`, `created_at`, and a CLI command that regenerates them.

### Recommendation

Use a static corpus for v1:

- `corpus.json`: metadata, source, license, source URL, optional Spotify/YouTube/MusicBrainz IDs
- `embeddings.npy`: L2-normalized embeddings
- `manifest.json`: model checkpoint, embedding dimension, source dataset, build command, date, checksum
- `examples.json`: 3-5 staged example query results

Add an "ingest one track" CLI, but do not build dynamic updates.

### Citations

- GitHub LFS exists for large binary artifacts, with Git storing pointer files while the object is stored separately: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
- DVC frames dataset/model versioning as codified version control for data and models: https://dvc.org/doc/use-cases/versioning-data-and-models

## Q4 — Eval methodology for music similarity

### Options considered

- **Exact-recording hit:** success only if the nearest match is the same recording.
- **Composition/song-family hit:** success if top-k returns another performance/version of the same underlying song.
- **Risk-label hit:** success if the verdict class matches a human-labeled risk class.
- **Hybrid eval:** rank-based retrieval metrics plus a smaller verdict calibration set.

### Trade-offs

Exact recording is too narrow for this product because AI-generated soundalikes and covers are not identical recordings. Song-family/composition matching is closer to cover-song identification, but it requires careful labels. A 4-class verdict rubric is product-useful, but with only ~30 examples it will be fragile.

Benchmarking norms support top-k/ranking metrics. Covers80 has 80 song pairs; Da-TACOS has benchmark and analysis subsets with 15,000 and 10,000 songs; SHS-100K metadata contains 10,000 works and 100,000 performances. These are much larger than this demo, so the demo should call its eval an initial calibration set, not a definitive benchmark.

### Recommendation

Use a hybrid eval:

- **Retrieval:** Recall@1, Recall@3, MRR/MR1, and MAP where labels allow.
- **Verdict calibration:** 4-class labels, but report confidence intervals or call it "initial calibration."
- **Golden set size:** minimum 60-100 query cases if possible; 30 is acceptable only as smoke-test calibration.
- **Labels:** exact same recording, same composition/version family, same artist/style but different song, unrelated.

### Citations

- Covers80 contains 80 songs, each performed by two artists: https://labrosa.ee.columbia.edu/projects/coversongs/covers80/
- Da-TACOS provides pre-extracted features and metadata for 15,000 benchmark songs and 10,000 analysis songs: https://github.com/MTG/da-tacos
- SHS-100K-2025 contains metadata for 10,000 works and 100,000 cover-version performances: https://secondhandsongs.com/page/API/100k
- Cover-song identification commonly uses MAP, MaRR/MRR, TOP10, and mean rank: https://asmp-eurasipjournals.springeropen.com/articles/10.1186/s13636-017-0108-2

## Q5 — Failure surface design

### Options considered

- **Technical error codes only**
- **Plain-language errors with details collapsed**
- **Plain-language errors plus next action**

### Trade-offs

Technical codes are useful for debugging but bad as the primary UI. The user needs to know what happened, whether to retry, and whether the result is missing because of their file, the local catalog, or a third-party service.

### Recommendation

Use plain copy plus a small technical code in muted text.

- `unsupported_media`: "This file type is not supported. Try an MP3, WAV, FLAC, OGG, or M4A file." Detail: `unsupported_media`.
- `empty_file`: "That file appears to be empty. Choose a different audio file." Detail: `empty_file`.
- `file_too_large`: "This demo accepts files up to 50 MB. Try a shorter export or compressed MP3." Detail: `file_too_large`.
- `decode_failed`: "We could not read this audio file. Re-export it as MP3 or WAV and try again." Detail: `decode_failed`.
- `empty_audio`: "The file decoded, but no audio samples were found." Detail: `empty_audio`.
- `no_corpus`: "The analyzer is online, but the reference catalog is unavailable. Similarity results cannot be computed right now." Detail: `no_corpus`.
- ACRCloud timeout: "The self-built similarity result is ready. The commercial second opinion timed out." Action: show CLAP result and a retry button for ACRCloud only.
- ACRCloud quota: "Commercial second opinion is temporarily unavailable because the demo quota is exhausted." Action: hide paid call from examples, keep CLAP result.

### Citations

- ACRCloud's Identification API uses signed multipart requests and has file-size guidance, so third-party timeout/quota states should be handled separately from local decode states: https://docs.acrcloud.com/reference/identification-api/identification-api

## Q6 — Example-chip behavior

### Options considered

- **Precomputed examples:** instant results loaded from static JSON.
- **Live rerun examples:** clicking an example sends audio through the backend.
- **Hybrid:** instant precomputed result with a "rerun live" affordance.

### Trade-offs

Precomputed examples are honest if labeled clearly: "precomputed demo example." They are better for a portfolio review because HF Spaces can cold-start and make the first click feel broken. Live reruns are more technically pure but may waste paid ACRCloud calls and expose visitors to cold-start latency. Hybrid gives both trust and speed.

### Recommendation

Use hybrid. Example chips should instantly show precomputed results, with visible copy such as "precomputed example" and an optional "rerun analysis" button. For the Suno reviewer, the app should not depend on a cold backend for the first impression.

### Citations

- Hugging Face states CPU Basic Spaces sleep after inactivity and restart when visited, which justifies precomputed examples for first-load UX: https://huggingface.co/docs/hub/spaces-gpus

## Q7 — Reference catalog source

### Options considered

- **Spotify previews**
- **FMA**
- **MTG-Jamendo**
- **Million Song Dataset**
- **ACRCloud catalog-as-a-service**
- **Hybrid mix**

### Trade-offs

Spotify is attractive for recognizability, but not a reliable demo audio source. Spotify's own docs mark `preview_url` as deprecated, nullable, and subject to preview-clip restrictions. Spotify's November 27, 2024 API change removed new Web API use-case access to 30-second preview URLs in multi-get `SimpleTrack` responses; their policy also says Spotify content may not be downloaded and may not be used to train or ingest into ML models.

FMA and MTG-Jamendo are rights-defensible and useful for a self-built corpus, but they will not reliably produce "oh, Blinding Lights" recognizability. FMA has Creative Commons-licensed audio and metadata at large scale. MTG-Jamendo has over 55,000 full tracks with Creative Commons licensing and tags. Million Song Dataset has recognizable metadata, but no audio in the core dataset; audio samples historically depended on 7digital availability.

ACRCloud gives recognizability through its commercial catalog, but it is not a substitute for the self-built CLAP reference catalog unless the product is reframed around a commercial second opinion. Pricing is login-gated.

### Recommendation

Use a hybrid:

1. **Self-built corpus:** FMA or MTG-Jamendo for lawful, reproducible CLAP retrieval.
2. **Recognition layer:** ACRCloud Cover Song/Humming Identification as a second opinion when credentials/budget allow.
3. **UI language:** "demo reference catalog" for self-built corpus; "commercial catalog check" for ACRCloud.

Do not promise "popular-song catalog" as a P0 unless ACRCloud is enabled or a licensed source is secured. The defensible v1 claim is: "searches a rights-defensible demo catalog and optionally compares against ACRCloud's commercial catalog."

### Citations

- Spotify `preview_url` is nullable and deprecated; Spotify content may not be downloaded or ingested into ML models: https://developer.spotify.com/documentation/web-api/reference/get-track
- Spotify's November 27, 2024 API change removed new Web API use-case access to 30-second preview URLs in multi-get `SimpleTrack` responses: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- FMA paper: 106,574 Creative Commons tracks, 917 GiB, 343 days of audio: https://arxiv.org/abs/1612.01840
- FMA metadata/audio details via UCI: https://www.archive.ics.uci.edu/ml/datasets/FMA%3A%2BA%2BDataset%2BFor%2BMusic%2BAnalysis
- MTG-Jamendo: over 55,000 full audio tracks under Creative Commons licenses: https://github.com/MTG/mtg-jamendo-dataset
- Million Song Dataset has metadata/features for one million tracks, but no audio in the core dataset: https://millionsongdataset.com/
- ACRCloud uses the ACRCloud Music bucket for recognition and supports cover/live/humming style identification: https://docs.acrcloud.com/tutorials/recognize-music

## Q8 — Audio embedding model

### Options considered

- **LAION-CLAP music checkpoint**
- **LAION-CLAP general/fusion checkpoints**
- **MERT**
- **MuLan / MuQ-MuLan family**
- **MusicCNN / AST / MFCC classical features**

### Trade-offs

LAION-CLAP music is the pragmatic v1 choice because the repo already uses CLAP, it supports audio embeddings, and LAION documents a music-specific checkpoint. It is not a specialized cover-song detector, so it must be calibrated. General CLAP checkpoints are broader but less clearly targeted to music. MERT is stronger as a music-understanding representation model and reports strong performance across music tasks, but it is heavier operationally and not already wired. MuLan-like systems are relevant conceptually but less straightforward as a deployable open-source CPU backend. MusicCNN, AST, MFCC/CQT methods are useful baselines, but they either target tagging/classification or require more engineering to become a robust similarity product.

### Recommendation

Keep LAION-CLAP music for v1. Add MERT as a documented future comparison, not an immediate implementation. If the reviewer asks "why CLAP?", the answer is: lowest integration risk, already deployed, good enough to evaluate, and paired with a clear calibration/eval plan.

### Citations

- LAION-CLAP lists `music_audioset_epoch_15_esc_90.14.pt` for music and general checkpoints for other audio use cases: https://github.com/LAION-AI/CLAP
- MusicGen config references the LAION CLAP music checkpoint as 512-dimensional: https://huggingface.co/spaces/facebook/MusicGen/blob/refs%2Fpr%2F73/config/conditioner/clapemb2music.yaml
- MERT is a music-specific self-supervised model that reports strong performance over 14 music understanding tasks: https://arxiv.org/abs/2306.00107

## Q9 — Vector search method

### Options considered

- **In-memory NumPy exact cosine sweep**
- **FAISS**
- **hnswlib**
- **pgvector**
- **ScaNN**

### Trade-offs

At 500 tracks, NumPy exact search is the right answer. Even 500,000 vectors of 512 floats is about 1 GB raw float32, before metadata/index overhead; the real pressure point is memory and hosting, not algorithmic complexity at demo scale. Approximate indexes add operational complexity and make eval slightly harder because approximate recall becomes another variable.

FAISS/hnswlib become relevant around tens or hundreds of thousands of vectors. pgvector is attractive if there is already a database and metadata filtering, but this project intentionally has no persistence. ScaNN is overkill.

### Recommendation

Use in-memory NumPy until at least 50k tracks. Document the migration path:

- 50k-500k: FAISS or hnswlib in memory.
- 500k+ with metadata filters/persistence: pgvector or a managed vector DB.
- Keep exact NumPy as the eval oracle even after adding approximate search.

### Citations

- HNSW is an approximate nearest-neighbor method for high-dimensional search: https://arxiv.org/abs/1603.09320
- hnswlib provides a Python/C++ approximate nearest-neighbor library: https://github.com/nmslib/hnswlib
- pgvector supports exact search by default and HNSW/IVFFlat indexes for approximate search: https://access.crunchydata.com/documentation/pgvector/latest/pdf/pgvector.pdf

## Q10 — ACRCloud Cover Song ID API actual integration details

### Options considered

- **Audio & Video Recognition API**
- **File Scanning product**
- **No ACRCloud**

### Trade-offs

ACRCloud has the right product surface: the tutorial explicitly distinguishes exact audio fingerprinting from cover song/humming identification and supports attaching the ACRCloud Music bucket. The Identify API is multipart/form-data with signed requests. The docs advise small files; the reference says file size should be below 5 MB, and the sample code comments recommend keeping requests under 1 MB / around 15 seconds where possible.

Response payloads expose `metadata.music` or `metadata.humming`, title, artists, external IDs/metadata, and `score`. For music recognition, ACRCloud documents score as a confidence score in range 70-100. For humming/cover-like metadata examples, scores appear as decimals such as `0.88`, so integration must inspect actual Cover Song ID responses from the chosen project type before hard-coding semantics.

Pricing is not public without login. ACRCloud docs say there is a 14-day free trial and pricing is available in the console after login; full pricing requires checking the ACRCloud Music bucket and third-party ID integration options.

ACRCloud also publicly documents AI Music Detection with supported categories including `suno` and `udio`, and internal performance claims, but that feature is not the same as Cover Song ID.

### Recommendation

Make ACRCloud conditional P1, not P0. Build the response adapter behind an interface:

```json
{
  "provider": "acrcloud",
  "status": "match|no_match|timeout|quota_exceeded|disabled",
  "title": "...",
  "artist": "...",
  "score": 88,
  "scoreSemantics": "acrcloud_music_confidence_70_100|acrcloud_humming_decimal_unknown",
  "externalIds": {}
}
```

Before shipping ACRCloud in the UI, run 20-30 real calls and document observed payload fields and score behavior.

### Citations

- ACRCloud Identification API request format, signed multipart request, file-size guidance: https://docs.acrcloud.com/reference/identification-api/identification-api
- ACRCloud Recognize Music tutorial, ACRCloud Music bucket, cover/humming identification, 14-day trial, login-gated pricing: https://docs.acrcloud.com/tutorials/recognize-music
- ACRCloud music metadata response fields and confidence score range 70-100: https://docs.acrcloud.com/reference/identification-api/metadata/music
- ACRCloud humming metadata example with title/artists/score fields: https://docs.acrcloud.com/reference/identification-api/metadata/humming
- ACRCloud AI Music Detection mentions `suno` and `udio` source categories and cautions that results are probabilistic: https://docs.acrcloud.com/faq/ai-music-detection

## Q11 — Backend hosting

### Options considered

- **Hugging Face Space CPU Basic**
- **Fly.io**
- **Modal**
- **Render Free**
- **Railway**

### Trade-offs

Hugging Face Space CPU Basic is the best fit for a free ML demo: official docs list CPU Basic as free with 2 vCPU and 16 GB RAM, and free hardware sleeps after inactivity. That fits CLAP import and a small in-memory corpus better than many general-purpose free tiers.

Render Free spins down after 15 minutes and takes about a minute to spin back up, with ephemeral filesystem on free web services. Fly.io no longer offers generally available free plans to new customers; legacy free allowances exist only for old plans. Modal is excellent for ML workloads and no-idle billing, but it is not "$0 steady-state" in the same simple portfolio-hosting sense. Railway free/credit plans change often and are less attractive than HF for a model-backed demo.

### Recommendation

Keep Hugging Face Space CPU Basic for v1. Make cold-start behavior explicit in the UI and README. If CLAP cold start proves too slow or unstable, move only the backend to Modal with a strict spend cap; keep the frontend static.

### Citations

- Hugging Face Spaces hardware table lists CPU Basic as 2 vCPU, 16 GB, free: https://huggingface.co/docs/hub/en/spaces-overview
- Hugging Face free CPU Basic Spaces sleep after inactivity, currently 48 hours: https://huggingface.co/docs/hub/spaces-gpus
- Render Free spins down after 15 minutes and spin-up takes about one minute; filesystem is ephemeral: https://render.com/free
- Fly.io docs say legacy free allowances are tied to discontinued plans, and Machines are billed while running: https://fly.io/docs/about/pricing/
- Modal pricing emphasizes no idle resource charges and compute-time billing: https://modal.com/pricing

## Q12 — Frontend hosting / CDN

### Options considered

- **Vercel**
- **Cloudflare Pages**
- **Netlify**

### Trade-offs

Vercel is already used and is fine for a static React portfolio app. Vercel's Hobby plan is free for personal projects and static files are automatically cached on the global network for the deployment lifetime after first request. Cloudflare Pages is also excellent for static assets and has very generous free limits, including 500 builds/month and 20,000 files on Free. Netlify is fine, but there is no strong reason to migrate.

The corpus JSON at 1-5 MB is a non-issue for any of these. The heavier artifact is `embeddings.npy`, which belongs on the backend or as a static backend-adjacent artifact, not fetched by the browser unless you intentionally build client-side search.

### Recommendation

Keep Vercel. Add immutable cache headers for hashed assets and normal cache headers for corpus metadata if served from frontend. Do not migrate unless Vercel free limits become a problem.

### Citations

- Vercel Hobby plan is free for personal projects and lists included usage: https://vercel.com/docs/accounts/plans/hobby
- Vercel automatically caches static files on its global network for the deployment lifetime after first request: https://vercel.com/docs/caching/cdn-cache
- Cloudflare Pages Free limits include 500 builds/month and 20,000 files: https://developers.cloudflare.com/pages/platform/limits/
- Netlify introduced a Free plan with monthly limits including bandwidth and build minutes: https://www.netlify.com/blog/introducing-netlify-free-plan/

## Q13 — CI / build

### Options considered

- **Commit `eval.json` and corpus manifest**
- **Generate eval on deploy**
- **Fetch eval at runtime**
- **Full ML experiment tracker**

### Trade-offs

Generating eval on deploy is risky because CLAP model load, dataset access, and ACRCloud quota can make builds slow or flaky. Fetching eval at runtime weakens reproducibility. A full MLflow/DVC setup is legitimate but too heavy unless the project grows.

For the Suno review, the best signal is a committed, reproducible snapshot: `eval.json`, `catalog_manifest.json`, and a script that can regenerate both. CI should run lightweight unit tests and a small smoke eval; full corpus rebuild should be manual or scheduled, not every PR.

### Recommendation

Commit:

- `catalog_manifest.json`
- `eval.json`
- `examples.json`
- small labeled golden-set CSV/JSON

CI:

- unit tests on every push
- no-CLAP frontend/backend contract tests
- optional slow job/manual workflow for CLAP ingest/eval
- artifact checksum validation

Use Git LFS or external storage only if embeddings/audio exceed normal repo comfort. Do not commit source audio unless licenses and size make that clearly acceptable.

### Citations

- Git LFS tracks large files through pointer files and supports large binary artifacts: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage
- DVC supports data/model versioning as codified reproducibility infrastructure: https://dvc.org/doc/use-cases/versioning-data-and-models
- MLflow evaluation can log metrics/artifacts, but is heavier than this v1 needs: https://mlflow.github.io/mlflow-website/docs/latest/ml/evaluation/

## Things you didn't ask but should consider

1. **Revise the PRD P0 catalog language.** Replace "≥200 tracks of real popular music" with "≥200 lawfully sourced reference tracks, with recognizability improved via ACRCloud when enabled." The current P0 overpromises unless a licensed popular catalog is secured.
2. **Make rights documentation P0.** The README must explain exactly what corpus is indexed, what rights exist, what is not covered, and how production would differ.
3. **Avoid "copyright detector" language everywhere.** Use "pre-publish acoustic similarity risk scanner."
4. **Add a model-card-style section.** Include known limitations: genre/style false positives, lyric-insensitive behavior, short-sample sensitivity, catalog incompleteness, threshold calibration weakness.
5. **Keep ACRCloud secrets server-side only.** The frontend should never see ACRCloud credentials; `/neighbors` should return a normalized provider result.
