# Codex prompt — PiedPiper Presearch

> Copy everything below the line into Codex. It is self-contained — Codex needs no other context.

---

You are doing a **Presearch** pass for a project called **PiedPiper** — a pre-publish acoustic-similarity scanner for AI-generated music. I need you to research the questions below and produce a structured opinion on each. Use web search liberally. Cite sources for any claim about pricing, current API status, deprecations, or model performance.

## Project context

The user uploads an AI-generated audio track (typically from Suno) and the app returns:

- The closest-matching real song from a reference catalog, with a cosine-similarity percentage (e.g., "87% similar to 'Blinding Lights' by The Weeknd")
- The top 3 nearest neighbors with similarity bars and link-outs to the source platform
- A verdict chip: `unique` / `related` / `similar` / `near-duplicate`
- A secondary inline status badge for track quality (broken-output detection: silence, clipping, noise, truncation, etc.)

**Existing architecture (~90% built):**
- Frontend: React + Vite, deployed on Vercel
- Backend: FastAPI on Hugging Face Space (CPU Basic, free tier)
- Audio analysis: librosa for quality signals; **CLAP (Contrastive Language-Audio Pretraining, music-tuned 512-d checkpoint)** for embeddings
- Similarity: L2-normalized cosine sweep against ~200–500 stored corpus embeddings
- Endpoint: `POST /neighbors` returns top-k matches + verdict
- Current threshold carry-over: cosine ≥0.95 = near-duplicate, ≥0.85 = similar, ≥0.70 = related, <0.70 = unique

**Audience:** This is a portfolio-grade artifact for a warm-intro review by the Head of Engineering at Suno (5–20 minute substantive read). Production-engineering judgment matters more than surface polish.

**Stretch goal:** Run **ACRCloud's Cover Song Identification API** as a parallel "second opinion" alongside the self-built CLAP pipeline, with side-by-side verdicts and an agreement metric on the eval page.

**Constraints:**
- Hosting: ~$0 steady-state ideal
- Catalog target size: 200–500 tracks
- Stateless demo; no user accounts; no persistence per visit
- No exact-recording fingerprinting (Shazam-style); the problem is *acoustic similarity*, not identity

## Your output

A structured markdown document titled **`# Codex Presearch — PiedPiper`** with this exact section layout. For each question:

```
## Q[N] — [Question name]
### Options considered
### Trade-offs
### Recommendation
### Citations
```

Be opinionated. Where you don't have ground truth (e.g., ACRCloud pricing without an account), say so explicitly.

---

## Pass 1 — Logic & app-flow questions

### Q1. Verdict decision tree
Are the current thresholds (≥0.95 near-dup, ≥0.85 similar, ≥0.70 related, <0.70 unique) reasonable for *AI-generated-music vs. real-music* similarity in CLAP-512 embedding space? What does the literature say about typical AI-soundalike cosine distances? How should we handle scores that fall right at a boundary?

### Q2. Hybrid disagreement handling
When the self-built CLAP pipeline says "near-duplicate" but ACRCloud Cover Song ID says "no match" (or vice versa), what should the user see? Survey patterns from dual-system risk pipelines (content moderation, fraud detection, code review): both side-by-side, the more conservative one, an "investigate" affordance, weighted ensemble, etc. Show what works in production T&S systems.

### Q3. Catalog freshness
For a portfolio-grade demo with a ~200–500-track catalog: static commit-time artifact vs. dynamic updates. How do similar projects (open-source MIR demos, music-similarity research codebases) handle "add a track" workflows? Re-embedding cost when CLAP checkpoints change.

### Q4. Eval methodology for music similarity
What counts as a "hit" in top-k retrieval for a music-similarity system — exact track, same artist, same song-family/composition? How is the golden set typically constructed (size, sampling strategy, labeling rubric)? Binary "unacceptable copy yes/no" vs. 4-class verdict labels — which is standard for similar pre-publish risk systems? Reference the SHS100K, Covers80, Da-TACOS cover-song detection datasets for benchmarking norms.

### Q5. Failure surface design
Best UI patterns for surfacing each error type to a non-technical user: `unsupported_media`, `decode_failed`, `empty_file`, `file_too_large`, `no_corpus`, third-party API timeout/quota exceeded. Provide concrete copy examples.

### Q6. Example-chip behavior
Are precomputed example results (shown instantly, no backend call) more honest or less honest than re-running the live pipeline each click? Best practices from comparable demos (Replicate, Hugging Face Spaces examples, etc.).

---

## Pass 2 — Tech stack questions

### Q7. Reference catalog source
Compare current (mid-2026) state of:
- **Spotify 30-second previews** — current API status, deprecation state, what's still accessible without a Premium account
- **FMA (Free Music Archive)** — coverage of recognizable popular music, licensing terms, dataset size
- **MTG-Jamendo** — coverage, licensing, recognizability
- **Million Song Dataset** — current availability and audio access in 2026
- **ACRCloud catalog-as-a-service** — can you query their catalog without running your own?
- **Hybrid mix** — pros and cons

The product needs matches to feel *recognizable* ("oh, Blinding Lights" lands; "track #4711 from MTG-Jamendo" doesn't) with a defensible rights story. Target catalog size: 200–500 tracks.

### Q8. Audio embedding model
For music-similarity use case (June 2026), compare:
- **LAION-CLAP music-tuned (the current carry-over, 512-d)**
- **LAION-CLAP general (~1024-d)**
- **MERT** (M-A-P research music encoder)
- **MuLan** (Google music-text model)
- **MusicCNN**, **AST (Audio Spectrogram Transformer)**, **MFCC + classical methods**, and any other contenders worth surfacing

For each: production-readiness, license, CPU inference cost, known performance on music-similarity benchmarks.

### Q9. Vector search method
At ~500 tracks, in-memory NumPy cosine sweep is fine (sub-millisecond). Question: at what scale does it stop being fine? Should we plan for FAISS / HNSW / ScaNN / pgvector now, or defer? Operational complexity cost of each.

### Q10. ACRCloud Cover Song ID API — actual integration details
- Current (2026) pricing tiers, free-tier limits, monthly cap options
- Request format (raw bytes? URL? duration cap?)
- Response payload structure — exact field names for top match, confidence score, match type
- Confidence score semantics — what does "70" mean vs "90"?
- Failure modes and SLAs
- Anything Suno-specific (since ACRCloud has publicly marketed an "AI Music Detector" for Suno/Udio)

### Q11. Backend hosting
For a CPU-only ML workload that imports CLAP and runs librosa per request, compare:
- **Hugging Face Space CPU Basic (free)** — cold-wake time in 2026, request limits
- **Fly.io free tier** — current limits, scale-to-zero behavior
- **Modal** — pricing and developer experience for ML workloads
- **Render free tier**
- **Railway free tier**

Cost target: $0 steady-state. Cold-start tolerance: moderate (UI mitigates with copy swap, but >60s is bad).

### Q12. Frontend hosting / CDN
Static React build + ~1–5 MB JSON corpus + ~1–2 MB SVG/example assets. Compare Vercel vs. Cloudflare Pages vs. Netlify in 2026 free tiers, with attention to CDN warmup for the corpus JSON.

### Q13. CI / build
For an audio-ML project with reproducible corpus + eval CLI runs, what's the right CI pattern? Where does `eval.json` live — committed to repo, generated on deploy, or fetched at runtime? Best practices for ML-eval reproducibility.

---

## Final notes

- **Don't pad.** Every recommendation should be defensible in one line.
- **Cite real URLs.** No invented references.
- **If you flag something I should look at on my side** (e.g., an alternative I should consider that I didn't ask about), call it out at the bottom under `## Things you didn't ask but should consider`.
- **Output the full structured doc.** No summary preface; just the doc.
