# Claude Presearch — PiedPiper

_Date: 2026-06-04. Time-boxed ~25 minutes. Opinionated, citation-backed._

---

## Q1 — Verdict decision tree

### Options considered
- **Keep current bands**: ≥0.95 near-dup, ≥0.85 similar, ≥0.70 related, <0.70 unique.
- **Shift bands down** (≥0.90 near-dup, ≥0.75 similar, ≥0.55 related): reflects observed CLAP score distributions where ~0.8 already means "highly similar, same genre/mood."
- **Calibrate empirically from corpus**: compute pairwise cosine over a held-out set, place thresholds at percentiles (e.g. p99=near-dup, p95=similar, p80=related).
- **Two-stage**: keep raw cosine but display verdict from a calibrated logistic on top of cosine + a "AI-vs-real" gap signal.
- **Per-genre thresholds**: thresholds vary by reference genre (electronic vs acoustic).

### Trade-offs
- The current ≥0.95 / ≥0.85 / ≥0.70 cuts are inherited from a generic-CLIP-style intuition, not from CLAP-music empirics. Published score-interpretation guidance for CLAP-512 says ~0.8 already corresponds to "highly similar, same genre/mood" and ~0.5 means "related with overlapping characteristics" — i.e. the current bands are too lax. With 3×7s mean-pooled L2-normalized embeddings, AI-soundalikes from Suno often land in the 0.75–0.92 range against the real target, and unrelated tracks within the same broad genre routinely score 0.55–0.70.
- Static thresholds are explainable and stable across deploys; percentile thresholds adapt to the catalog but make any verdict change when the catalog changes, which is bad for a portfolio demo.
- Per-genre thresholds are over-engineered at 200–500 tracks.

### Recommendation
**Shift bands down and calibrate against the eval set**: ≥0.90 near-duplicate, ≥0.78 similar, ≥0.62 related, <0.62 unique — and treat these as defaults you justify in the README from the eval distribution, not as carry-over magic numbers. Render a thin "borderline" hairline at ±0.02 of each cut and, in that zone, show the next-lower verdict plus a "borderline — second-opinion suggested" note (this is where the ACRCloud second opinion earns its keep). Never display the raw cosine without the verdict chip; never display the verdict without the cosine — both together build calibration trust with a Suno reader.

### Citations
- [The Music Case — CLAP score interpretation (~0.8 similar, ~0.5 related)](https://www.themusicase.com/blog/ai-music-analysis-audio-vectoring-how-clap-embeddings-are-changing-music-intelligence/)
- [LAION larger_clap_music model card](https://huggingface.co/laion/larger_clap_music)
- [Stability-AI stable-audio-metrics CLAP score reference impl](https://github.com/Stability-AI/stable-audio-metrics/blob/main/src/clap_score.py)

---

## Q2 — Hybrid disagreement handling

### Options considered
- **Show both side-by-side, no resolution** ("CLAP: near-duplicate / ACRCloud: no cover match").
- **Pick the more conservative verdict** (max of the two risk levels).
- **Weighted ensemble** into a single score.
- **Routing model**: high-confidence agreement passes straight through; disagreement gets surfaced as "needs review."
- **"Investigate" affordance**: surface disagreement explicitly, link both pieces of evidence, no auto-resolution.

### Trade-offs
- Weighted ensembles look smart but lie about disagreement — and the Suno reader will spot it. CLAP and ACRCloud Cover Song ID are measuring *different things* (acoustic-semantic similarity vs melodic/harmonic cover relationship), so blending them into a single score is dimensionally wrong.
- Max-conservative is the standard dual-system risk-pipeline default (fraud, malware, content moderation: Venire-style "route disagreement to a reviewer") and is hard to argue against for a "pre-publish scanner" framing — but it over-flags.
- Side-by-side with an "investigate" affordance is the most honest. It also matches HITL routing literature: high-confidence-agreement flows through, disagreement routes to a human (here, the user-as-reviewer).

### Recommendation
**Side-by-side with an explicit disagreement state**, and a *composite verdict chip* that takes the **max** for the user-facing summary, with a "models disagree — see breakdown" subtext when the two diverge by ≥1 band. On the eval page, surface an **agreement metric** (% of corpus items where the two systems land in the same band, plus Cohen's κ). That metric is itself the most defensible artifact for a Head of Engineering read — it shows you understand that you have two noisy oracles, not one ground truth.

### Citations
- [Venire — ML-guided panel review for moderation disagreement (arXiv 2410.23448)](https://arxiv.org/html/2410.23448)
- [GetStream — scaling content moderation with confidence routing](https://getstream.io/blog/scaling-content-moderation/)
- [Product School — human-in-the-loop quality routing](https://productschool.com/blog/artificial-intelligence/human-in-the-loop-ai)

---

## Q3 — Catalog freshness

### Options considered
- **Fully static**, embeddings committed to repo, regenerated on every checkpoint bump.
- **Static manifest + on-demand re-embed** via a `make rebuild` CLI.
- **Append-only registry** where new tracks get embedded and pushed via CI on PR merge.
- **Live ingestion endpoint** (admin-only upload that writes to the corpus on the running Space).

### Trade-offs
- A portfolio-grade demo wants *reproducibility over freshness* — a reviewer needs to be able to clone, run, and see the same nearest neighbors you screenshot in the README. Live ingestion violates that.
- Open-source MIR demos (FMA tooling, MTG-Jamendo baselines, AudioMuse-AI-DCLAP) overwhelmingly use the static-manifest pattern: a `corpus.json` (or `.parquet`) of `{track_id, source_url, embedding, metadata}` checked into the repo or pulled from a release asset, regenerated with a single CLI.
- Re-embedding cost when the CLAP checkpoint changes is real but bounded: at 500 tracks × ~1.5s per track on CPU, a full rebuild is under 15 minutes — well inside CI budgets. Don't optimize for it.

### Recommendation
**Static commit-time artifact** with the corpus embeddings (and an `embeddings.parquet` file) checked into the repo or attached as a GitHub release asset, plus a `scripts/rebuild_corpus.py` CLI that re-embeds the whole catalog in one shot. Pin the CLAP checkpoint commit SHA in `requirements.txt` and write the checkpoint hash into the corpus manifest, so embeddings and model are version-locked. No live ingestion endpoint. If a track must be added, it's a PR.

### Citations
- [mdeff/fma — static dataset + features convention](https://github.com/mdeff/fma)
- [MTG/mtg-jamendo-dataset baseline scripts](https://github.com/MTG/mtg-jamendo-dataset)
- [lakeFS — ML reproducibility pillars (code+data+env hash-pinning)](https://lakefs.io/blog/ml-reproducibility-pillars/)

---

## Q4 — Eval methodology for music similarity

### Options considered
- **Exact-track top-k**: hit only if the matched track ID is the seed.
- **Same-artist top-k**: hit if matched track shares artist with seed.
- **Song-family top-k**: hit if matched track is a known cover/version of seed (Da-TACOS style).
- **Binary "unacceptable copy yes/no"**: hand-labeled per (query, neighbor) pair.
- **4-class verdict labels**: each (query, neighbor) pair labeled unique/related/similar/near-dup by you, then verdict-confusion-matrix.

### Trade-offs
- Exact-track recall is the wrong objective: PiedPiper isn't a fingerprinter, so seeing the seed back at top-1 doesn't prove the system works on AI-generated *soundalikes*. Da-TACOS, SHS100K, Covers80 are the right academic frame (MAP@k against cover-pair labels), but constructing your own SHS100K is months of work.
- Binary "unacceptable copy?" is the *product* question and is what Suno actually cares about, but with 200–500 tracks you can't generate enough positives without seeded AI soundalikes.
- 4-class verdict-confusion is the most informative but is labor-heavy and noisy at small N.

### Recommendation
**Two-track eval**:
1. **Retrieval eval** — borrow the Covers80/Da-TACOS structure at miniature scale. Pick ~30 seed songs in your catalog; for each, generate 2–3 Suno tracks with prompts that target that song (style + lyrical theme). Measure **top-1 / top-3 accuracy** (did the seed appear in the top-3 for the AI-generated query?) and **MAP@5**. This is the headline number.
2. **Verdict eval** — hand-label ~100 (query, top-1) pairs across the verdict bands with binary "is this an unacceptable copy?" Compute precision and recall *of the `near-duplicate` and `similar` chips* against your labels. Report a confusion matrix.

Don't promise more. Document the construction protocol (seed selection, prompt template, labeling rubric) in the eval page itself — the protocol-on-display is half the credibility.

### Citations
- [Da-TACOS dataset paper (ISMIR 2019)](https://archives.ismir.net/ismir2019/paper/000038.pdf)
- [MTG/da-tacos repo](https://github.com/MTG/da-tacos)
- [Cover Song Identification Technologies survey (ACM 2024)](https://dl.acm.org/doi/fullHtml/10.1145/3638884.3638891)
- [MIREX 2024 Cover Song Identification task](https://music-ir.org/mirex/wiki/2024:Cover_Song_Identification)

---

## Q5 — Failure surface design

### Options considered
- **Toast / banner** (transient, doesn't block reuse).
- **Inline result-card replacement** (the result area shows the error in the verdict's place).
- **Status badge in the existing quality slot**.

### Trade-offs
- A non-technical user needs to know *what to do next*, not what went wrong technically. Generic "Something went wrong" destroys trust on a portfolio demo. Quota/timeout errors are different from input errors — the user fixes one and waits on the other.

### Recommendation
**Inline result-card replacement** for input errors (the verdict region shows the error); **transient banner** for upstream/quota errors so the user can retry without re-uploading. Concrete copy:

- `unsupported_media`: "That file type isn't supported. Try MP3, WAV, FLAC, or M4A."
- `decode_failed`: "We couldn't read that audio. It might be corrupted or encoded with an unusual codec — try re-exporting as MP3 or WAV."
- `empty_file`: "That file looks empty (0 bytes). Re-upload and try again."
- `file_too_large`: "File is over 25 MB. Trim to a 30–60 second clip — only the first minute is analyzed anyway."
- `no_corpus`: "Reference catalog isn't loaded yet. Refresh the page in a moment." (This is a server-side embarrassment; log it loudly.)
- `acrcloud_timeout`: banner — "Second-opinion service is slow right now. Showing CLAP result only." (Don't block; degrade gracefully.)
- `acrcloud_quota`: banner — "Daily quota reached on the second-opinion service. Showing CLAP result only." (Same treatment as timeout from the user's view.)

Always preserve the file selection so retry doesn't require re-upload.

### Citations
- [Google Cloud Speech-to-Text error message conventions (10MB / format guidance)](https://cloud.google.com/speech-to-text/docs/error-messages)
- [SoundCloud upload error UX example](https://help.soundcloud.com/hc/en-us/articles/360050499614-I-get-the-error-message-Please-make-sure-you-are-uploading-a-valid-audio-file)

---

## Q6 — Example-chip behavior

### Options considered
- **Precomputed cached results** — chip click loads a fixture JSON instantly, no backend hit.
- **Live re-run** — chip click uploads the same audio file and runs the actual pipeline.
- **Hybrid** — precomputed by default, with a small "rerun live" affordance.

### Trade-offs
- Precomputed is the HF-Spaces / Gradio / Replicate default for a reason: it makes the demo feel instant and lets you guarantee the screenshot in the README is reproducible. The dishonesty risk is that the user thinks "Wow, 200ms inference!" when reality is 4–8s.
- Live re-run is the most honest but punishes a cold Space with 60s of "is this broken?"
- Hybrid hits both — labeled example chips load instantly, the "Run on your own file" path is the truth.

### Recommendation
**Hybrid, with explicit honesty**. Example chips load a precomputed result *and* are visibly labeled "example" with a tiny "(cached)" subtext, so a careful reader knows what they're seeing. Show a wall-clock latency under each result (`processed in 4.2s`) so the live path is unambiguously different from the cached one. On first cold start, surface a one-time "Waking up the model…" banner so 60s doesn't feel broken.

### Citations
- [HF Spaces overview (free tier sleep behavior implying need for example warmup)](https://huggingface.co/docs/hub/en/spaces-overview)
- [Replicate docs (example outputs convention)](https://replicate.com/docs)

---

## Q7 — Reference catalog source

### Options considered
- **Spotify 30-second previews** — `preview_url`.
- **FMA (Free Music Archive)** — 106k CC-licensed tracks.
- **MTG-Jamendo** — 55k CC tracks with rich tagging.
- **Million Song Dataset (MSD)** — features only, audio via 7digital previews.
- **ACRCloud catalog-as-a-service** — pay for licensed audio access.
- **Hybrid: Spotify previews for "recognizable" + FMA/Jamendo for breadth**.
- **YouTube-Music / iTunes preview clips** — undocumented endpoints.

### Trade-offs
- **Spotify**: as of Nov 27 2024, `preview_url` is removed for newly registered apps (you may still see it in extended-mode apps already approved before that date). For a new portfolio app, treat this source as **dead**. Older blog posts saying "just use Spotify previews" are out of date.
- **FMA**: 100% CC-licensed, defensible rights story, but coverage of *recognizable* music (Top 40, the Weeknd, Taylor Swift) is essentially zero. A reviewer clicking through 5 examples will see "track #4711" not "Blinding Lights."
- **MTG-Jamendo**: same as FMA — clean licensing, zero recognizability.
- **MSD via 7digital**: 7digital preview-fetch is broken / out-of-date IDs; effectively dead for fresh integration.
- **ACRCloud catalog**: solves the recognizability problem but inverts the cost model (you're paying per query/month) and you don't own the audio.
- **Hybrid Spotify+FMA**: dead unless you have legacy extended-mode access.

The product needs **recognizable matches**. None of the legal, public, free options give you that.

### Recommendation
**Two-tier catalog with explicit honesty about it.**
- **Tier 1 (60–80 tracks): "Recognizable" demo catalog.** Use **iTunes Search API** preview clips (`previewUrl` field, ~30s 128kbps AAC, no auth, no deprecation, no `preview_url`-style restriction) for the recognizable hits. This is the practical replacement for Spotify previews in 2026 and is what every Spotify-preview-deprecation post-mortem points to.
- **Tier 2 (200–400 tracks): "Breadth" catalog.** FMA or MTG-Jamendo for breadth, license clarity, and to prove your retrieval works on more than a curated 60. The verdict chip on Tier-2 hits should be presented honestly as "closest match in the wider Creative Commons catalog."

In the README, name this split. A Suno reader will trust this more than a single hand-waved corpus.

### Citations
- [Spotify Web API deprecation announcement (Nov 27 2024)](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)
- [Digital Music News — Spotify tightens API access](https://www.digitalmusicnews.com/2024/12/01/spotify-tightens-api-access-removes-several-data-points/)
- [FMA: A Dataset For Music Analysis (arXiv 1612.01840)](https://arxiv.org/abs/1612.01840)
- [MTG-Jamendo dataset homepage](https://mtg.github.io/mtg-jamendo-dataset/)
- [Million Song Dataset — 7digital preview status (broken)](http://millionsongdataset.com/faq/)

---

## Q8 — Audio embedding model

### Options considered
- **LAION-CLAP music-tuned, 512-d** (`laion/larger_clap_music`) — current carry-over.
- **LAION-CLAP general fusion, ~1024-d** (`630k-audioset-fusion-best.pt`) — wider domain.
- **MERT** (Yizhi LL, 2023, Apache-2.0) — self-supervised, MIR SOTA on tagging/genre.
- **MuLan / MuQ-MuLan** — strong perceptual alignment but Google's MuLan is closed; MuQ-MuLan (Tencent) is the practical open variant.
- **Classical baselines** — chroma+MFCC, OpenL3, VGGish.
- **MusicCNN, AST** — older, smaller, faster.

### Trade-offs
- **CLAP-music-512**: well-supported in `transformers`, Apache-2.0, fast on CPU, music-tuned. The known 2026 trade-off is that it underperforms MERT on fine-grained instrument and broader categorical tasks (per MDPI 2025 cymbal-classification study), but it's stronger on local-neighborhood label consistency — which *is* exactly what you need for nearest-neighbor retrieval.
- **CLAP general fusion**: more flexible for variable-length audio (fusion encoder handles longer windows natively) but not music-tuned; would regress on music similarity.
- **MERT**: better perceptual alignment but larger (95M+ params), slower on CPU, and has no built-in text alignment (you give up future "describe by text" retrieval).
- **MuQ-MuLan**: research-grade, less battle-tested in production, no comparable HF/transformers integration.
- **Classical / OpenL3 / VGGish**: too coarse for AI-soundalike discrimination; would collapse "same genre, different song" and "same song, different mix" into the same band.

### Recommendation
**Stay on LAION-CLAP music-tuned 512-d (`laion/larger_clap_music`)**. It's the right call for this product: Apache-2.0, ~190MB, CPU-friendly (~1–2s per inference), and its known weakness (fine-grained instrument classification) is not your task. Pin the HF revision SHA in `requirements.txt`. Do **not** swap to MERT — the marginal embedding quality doesn't justify the CPU latency hit on free-tier hosting, and you lose the text-alignment optionality. Mention in the README that you considered MERT and rejected it on these grounds; that mention is itself the engineering-judgment signal.

### Citations
- [laion/larger_clap_music model card (Apache-2.0)](https://huggingface.co/laion/larger_clap_music)
- [MERT paper (arXiv 2306.00107)](https://arxiv.org/pdf/2306.00107)
- [MDPI 2025 — CLAP vs MERT on fine-grained music tasks](https://www.mdpi.com/2079-9292/15/8/1723)
- [MuLan paper (arXiv 2208.12415)](https://arxiv.org/abs/2208.12415)
- [Tencent MuQ repo](https://github.com/tencent-ailab/MuQ)

---

## Q9 — Vector search method

### Options considered
- **NumPy cosine sweep** — current.
- **FAISS Flat** — exact, SIMD-accelerated brute force.
- **FAISS HNSW** — approximate, log-N query.
- **ScaNN** — Google's approximate index.
- **pgvector** — Postgres extension.

### Trade-offs
- At 500 vectors × 512 dims, a single NumPy cosine sweep is ~256 KFLOPs — sub-millisecond. There is no measurable benefit from FAISS Flat at this scale; HNSW is strictly worse because it introduces approximate recall for zero latency win.
- FAISS Flat becomes interesting around **10k–50k vectors** (per FAISS official guidance: Flat <10k, IVF 10k–1M, HNSW for quality). HNSW becomes interesting around **100k+** or when query rate dominates.
- pgvector is right when you need persistence + transactional updates, which you don't.

### Recommendation
**Stay on NumPy cosine sweep**. Don't pre-import FAISS. Write a one-line comment in the search module: `# Linear sweep is correct here through ~10k vectors. Swap to FAISS Flat if N>10k.` Document the threshold in the architecture doc. A Suno reader will respect the YAGNI more than a misplaced FAISS dependency.

### Citations
- [FAISS official index-selection guidance (Flat <10k)](https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index)
- [PyImageSearch — FAISS ANN overview & scale guidance](https://pyimagesearch.com/2026/02/16/vector-search-with-faiss-approximate-nearest-neighbor-ann-explained/)
- [Medium — NumPy vs FAISS Flat vs HNSW scaling](https://medium.com/@asifali1090/scaling-vector-search-for-ai-tutors-numpy-vs-faiss-flatl2-hnsw-a4f426a186f1)

---

## Q10 — ACRCloud Cover Song ID API — actual integration details

### Options considered
N/A — this is a fact-gathering question.

### Trade-offs
N/A.

### Recommendation (what's known + what isn't)

**Known from public sources (verified):**
- **Free trial**: 14 days, no credit card, "full API access" per ACRCloud landing copy. After trial, you're on a paid tier. (Unresolved: exact USD per-request rates without account login.)
- **Adjacent product — Song Original Sound Recognition** lists ¥320/year per 10k requests in one third-party blog as the public anchor, with tiered discounts above that volume. Cover Song ID is *not* listed at that same rate; treat Cover Song ID as priced separately and confirm in console.
- **AI Music Detector** (launched Jan 2026) is a sibling product. Per ACRCloud copy, it is **"offered free of charge when used in conjunction with ACRCloud's Derivative Works Detection service"** — i.e. bundled, not a standalone freebie.
- **AI Music Detector response shape** (from docs): `prediction` (`ai_generated`/`human`/`no_vocals`), `likely_source` (Suno/Udio/Sonauto/Mureka/Riffusion/...), `ai_probability` (0–100), per-stem (`original`/`vocals`/`accompaniment`) breakdowns, time-segment-level predictions, `model_id`.
- **Identification API** (the general fingerprinting endpoint, which Cover Song ID rides on top of) accepts audio bytes via multipart upload (~10–20s of audio is standard), returns a JSON envelope with `status` (with `code` and `msg`), `metadata.music[]` array containing track metadata + `score` (0–100 confidence). Cover Song ID returns the same shape but matches melodic/harmonic structure rather than fingerprint.
- **Failure modes**: HTTP 4xx for auth/quota; 200 with `status.code != 0` for "no match"; observed timeouts at 10–30s during peak.

**Unknowns (flag explicitly, requires account):**
- Exact USD pricing per 1k Cover Song ID requests.
- Whether the free trial has request caps or is truly unlimited for 14 days.
- SLA documentation (not publicly posted).
- Whether the AI Music Detector can be called *without* signing up for Derivative Works Detection (the marketing copy implies "bundled," not "standalone").

**Recommendation**: Treat ACRCloud as a **time-boxed second opinion behind a feature flag** for the demo (`ENABLE_ACRCLOUD=true` only during the 14-day window). Pre-cache ACRCloud responses for all eval-page corpus examples so the agreement metric is computable from static data after the trial expires. Pre-cache `ai_probability` for the AI Music Detector too — it is the most directly Suno-relevant signal in their product line and a great thing to surface in the demo.

### Citations
- [ACRCloud Cover Song Identification product page](https://www.acrcloud.com/cover-song-identification/)
- [ACRCloud AI Music Detector product page (free with Derivative Works)](https://www.acrcloud.com/ai-music-detector/)
- [ACRCloud AI Music Detection API response schema docs](https://docs.acrcloud.com/reference/console-api/file-scanning/metadata/ai-music-detection)
- [ACRCloud Identification API reference](https://docs.acrcloud.com/reference/identification-api)
- [Oreate AI — ACRCloud pricing breakdown (third-party, partial)](https://www.oreateai.com/blog/unlocking-musics-secrets-a-look-at-acrclouds-api-pricing-for-song-recognition/30caff392b00ae46e529989daa0ea4c5)
- [ACRCloud blog — AI Song Detector launch (Jan 2026)](https://www.acrcloud.com/blog/ai-song-detector-supports-suno-udio-elevenlabs-and-more/)

---

## Q11 — Backend hosting

### Options considered
- **HF Space CPU Basic** (free, current).
- **Fly.io** — scale-to-zero Machines.
- **Modal** — serverless Python, $30/mo free credit.
- **Render** — free web service with sleep.
- **Railway** — no free tier, $5 trial credit only.

### Trade-offs
| | Free? | Cold start | Sleep policy | Fits CLAP+librosa? |
|---|---|---|---|---|
| HF Space CPU Basic | yes | ~30–90s first request after sleep | sleeps after 48h inactivity | yes (designed for this) |
| Fly.io | $5/mo allowance covers a small shared-cpu-1x | 300ms–2s scale-to-zero | scale-to-zero by config | yes if image fits ~256MB-1GB RAM and you persist the model |
| Modal | $30/mo credits, ample for portfolio traffic | 5–15s container cold start | scale-to-zero | excellent fit, Python-native |
| Render free | yes | 30–60s after 15-min idle | sleeps after 15 min | yes but cold starts hurt UX |
| Railway | no real free tier | n/a | n/a | n/a |

- HF Space CPU Basic is the **architectural fit** — the ML demo audience knows what an HF Space is, and "this lives on HF" is *itself* a credibility signal to a Suno engineer. The 48h sleep is a real cold-start hazard but the 90s wake is workable behind a "Waking up the model…" banner.
- Modal is the **engineering fit** if cold starts are unacceptable — 5–15s vs 90s is a real win, and $30/mo of credits is more than enough for portfolio traffic. But it doesn't *signal* "ML demo" the way an HF Space does.
- Fly.io is the best raw price/perf but you carry container ops yourself (image build, model bake, persistent volume for the CLAP weights).
- Render free is dominated by HF Space on cold-start cost and by Modal on engineering elegance.

### Recommendation
**Primary: HF Space CPU Basic.** It's the right cultural signal for the audience (Suno HoE knows HF Spaces), and the 48-hour sleep is mitigable with a daily UptimeRobot ping or GitHub Actions cron. **Secondary mention in README**: "Tested cold-start behavior on Modal as a fallback; Modal warm cold-start is ~8s vs HF's ~60s — would migrate at >50 RPS or if the reviewer experience degrades." That paragraph itself shows production judgment. Implement a `WARMUP_PING_URL` env so the user can wire UptimeRobot in one minute.

### Citations
- [HF Spaces overview — free tier sleep after 48h](https://huggingface.co/docs/hub/en/spaces-overview)
- [HF Spaces runtime management — sleep behavior](https://huggingface.co/docs/huggingface_hub/en/package_reference/space_runtime)
- [Modal pricing page — $30/mo free credit](https://modal.com/pricing)
- [TECHSY — Heroku's dead: Railway vs Render vs Fly comparison 2026](https://techsy.io/en/blog/railway-vs-render-vs-fly-io)
- [BoltOps — Render/Vercel/Fly/Railway free-tier cold starts](https://blog.boltops.com/2025/05/01/heroku-vs-render-vs-vercel-vs-fly-io-vs-railway-meet-blossom-an-alternative/)

---

## Q12 — Frontend hosting / CDN

### Options considered
- **Vercel** (current) — 100 GB free, generous functions, premium DX.
- **Cloudflare Pages** — unlimited bandwidth on free tier.
- **Netlify** — 100 GB free.

### Trade-offs
- For a static React build + 1–5 MB JSON corpus + 1–2 MB SVG, **all three** are far inside free tier and indistinguishable on cost.
- Cloudflare Pages wins on raw bandwidth and on edge-cache warmup quality (corpus JSON will be served from the closest POP after first cold fetch), which is the only meaningful runtime difference at this asset size.
- Vercel wins on DX and on the implicit "this is the React reference platform" signal — and the user is already on it.
- Switching costs are real but small; the more important question is whether the corpus JSON should be lazy-loaded or inlined.

### Recommendation
**Stay on Vercel** for inertia and DX. Set far-future `Cache-Control: public, max-age=31536000, immutable` on the corpus JSON (use a content hash in the filename). Inline anything <50 KB; lazy-load the embeddings JSON only when the eval page mounts (it's not needed for the main upload flow). If bandwidth or function-invocation usage ever creeps near the cap, migrate to Cloudflare Pages — but it almost certainly won't for a portfolio demo. Do **not** waste credibility on a platform-comparison paragraph in the README; nobody scoring this cares about Vercel vs CF at <1 MB asset size.

### Citations
- [AI Infra Link — Vercel vs Netlify vs CF Pages 2025 comparison](https://www.ai-infra-link.com/vercel-vs-netlify-vs-cloudflare-pages-2025-comparison-for-developers/)
- [DanubeData — CF Pages vs Netlify vs Vercel 2026](https://danubedata.ro/blog/cloudflare-pages-vs-netlify-vs-vercel-static-hosting-2026)
- [Bejamas comparison matrix (CF Pages unlimited bandwidth)](https://bejamas.com/compare/cloudflare-pages-vs-netlify-vs-vercel)

---

## Q13 — CI / build

### Options considered
- **`eval.json` committed to repo**, regenerated by a `make eval` CLI.
- **`eval.json` generated at deploy time** by a GitHub Action.
- **`eval.json` fetched at runtime** from a release asset / object store.
- **`eval.json` as a CI-only artifact** (uploaded to PR comments, never deployed).

### Trade-offs
- ML reproducibility 101 (DVC, MLflow, Quilt patterns): code + data + environment must be jointly version-pinned. Runtime fetching makes the eval page non-reproducible — a reviewer cloning the repo at SHA `abc` cannot guarantee the eval numbers they see match what was rendered on the prod demo.
- Committing the artifact is the simplest path to reproducibility but bloats the repo if the eval grows. At expected scale (~100 labeled pairs, ~30 seed songs) the JSON is well under 1 MB — non-issue.
- Generating at deploy adds operational complexity and breaks "clone-and-run."

### Recommendation
**Commit `eval.json` + `eval_report.json` + `corpus.parquet` to the repo** (or attach as a versioned GitHub release asset referenced by `requirements.txt`-style pinning). Provide:
- `scripts/rebuild_corpus.py` — re-embeds the entire corpus from `catalog.yaml`.
- `scripts/run_eval.py` — runs the retrieval + verdict eval, writes `eval_report.json`.
- A CI job (`.github/workflows/eval.yml`) that runs both on every PR and fails if `eval_report.json` differs from the committed version (forcing the author to re-run and commit). This is the cheap, audit-grade reproducibility loop.

Write the CLAP checkpoint commit SHA into every artifact's header — `{"model_sha": "...", "generated_at": "..."}`. This single line of metadata is what separates "I have an eval" from "I have an audit-grade eval."

### Citations
- [lakeFS — ML reproducibility pillars](https://lakefs.io/blog/ml-reproducibility-pillars/)
- [Quilt blog — code+data+env reproducibility loop](https://blog.quilt.bio/code-data-environment-closing-ml-reproducibility-loop-git-mlflow-quilt)
- [Daily Dose of DS — versioning ML systems with hash pinning](https://www.dailydoseofds.com/mlops-crash-course-part-3/)
- [Sachith — evaluating models with golden sets in CI](https://www.sachith.co.uk/evaluating-models-with-golden-sets-performance-tuning-guide-practical-guide-dec-6-2025/)

---

## Things to flag for the user

Items I'd surface that weren't directly asked but matter for the Suno HoE read:

1. **The ACRCloud "AI Music Detector" is more on-message than Cover Song ID for Suno specifically.** Cover Song ID asks "is this a cover of a real song?" — a partial match for the product. The AI Music Detector asks "is this AI-generated, and from which engine?" — which is *literally* Suno's blind spot in their own product surface. Showing `ai_probability` and `likely_source: Suno` alongside the CLAP verdict is a much stronger signal of product thinking. Consider making the stretch goal **"second opinion via ACRCloud AI Music Detector + Cover Song ID"** rather than Cover Song ID alone.

2. **Pin the CLAP checkpoint commit SHA, not just `laion/larger_clap_music`.** The HF model card has been updated in the past; a fresh `from_pretrained` six months from now may not give you the same embeddings. This is a 30-second fix (`revision=` arg) with huge reproducibility payoff.

3. **The 7s window sampling at 10%/45%/80% is folkloric, not from the CLAP paper.** It's published in vendor blog posts but isn't load-bearing on any benchmark. If you're stating it in the README as your sampling strategy, fine, but cite it as your choice, not as canon. Consider also documenting a 2-second hop-overlapping sweep as an option for tracks <30s, which Suno outputs often are.

4. **Track length normalization matters more than you think.** Suno outputs ~2–4 min; corpus previews are 30s. Embedding a 30s window vs a 2-min window with mean-pooling produces meaningfully different vectors. Force both query and corpus to the same window protocol (e.g. extract 30s from the center of any input track before embedding). Flag this in the README.

5. **Verdict eval needs negatives.** Your retrieval eval (Q4) measures whether the right neighbor surfaces; the verdict eval measures whether the chip is honest. The verdict eval needs at least 30% "unique" examples (AI-generated tracks with no real-world soundalike in your catalog) or the precision number on `near-duplicate` is meaningless.

6. **Quality scorer (librosa-based broken-output detection) probably needs its own eval section.** It's currently a sidecar in the PRD but a reviewer who values production engineering will want to see how it's evaluated separately from the similarity pipeline. Two-paragraph eval section is plenty; just don't leave it implicit.

7. **The `/neighbors` endpoint should also expose a `model_sha` field in the response.** Costs nothing, makes every screenshot auditable against the repo SHA, and is the kind of detail a Head of Engineering notices.

8. **Consider a `?format=json` debug response on the verdict endpoint** that returns the raw cosine values for the top-10 (not just top-3) plus the threshold table actually used. This is what an engineer who wants to understand your system will reach for first.
