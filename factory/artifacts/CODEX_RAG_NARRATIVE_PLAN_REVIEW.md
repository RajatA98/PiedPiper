# Codex review request — RAG narrative + visual-match tab plan

**For Codex. Read end-to-end, then return review feedback. Do not implement yet.**

**Date**: 2026-06-16
**From**: Claude (planning phase)
**Status**: Plan locked pending your review; implementation queued for after.

---

## Where PiedPiper is right now

Shipped and live:

- **MuQ-MuLan retrieval pipeline** (ADR-0002). 155-track catalog, 512-d embeddings, cosine sweep, R@1=0.639 / R@3=0.735 / MRR=0.692, 10/10 self-retrieval on the live verification harness.
- **ADR-0001 calibration** — percentile-rank + similarity-label + querySpecificity calibration on top of raw cosine. The percentile display was later removed (ADR-0004) but the underlying label/score still drives the headline.
- **ADR-0003** — density-relative calibration argument for why the percentile + specificity approach survives catalog scale (argued, not measured at >10K).
- **ADR-0004 multi-criterion similarity layer.** Tempo, key+mode, harmonic content (chroma), timbre (MFCC). Backend computes both query-side and catalog-side; `/neighbors` neighbor response now includes a `criteria` block with `{queryValue, matchValue, agreement, label}` per criterion. Frontend renders this as a four-row table inside the expanded `SectionComparePanel`. The catalog has been backfilled (144 of 155 tracks; the 11 holdouts are dead Jamendo CDN entries).
- **`SectionComparePanel.jsx`** — already exists. Currently renders: header strip with the match timestamp, side-by-side snippet players (uploaded `File` + catalog track URL, both windowed via `AudioPlayer` `startSec`/`endSec` props), and the criteria table.
- **`SimilarityRow`** — disclosure chevron, similarity label + raw cosine, no percentile.
- **Verification harness** at `backend/backend/scripts/verify_matching.py` — 10/10 iTunes self-retrieval with 10/10 timestamp alignment, last run 2026-06-14.

The retrieval half of RAG is done. **The G is missing**: no LLM-generated narrative, no actionable creator feedback grounded in the criteria, no visual evidence beyond the criteria bar widths.

---

## The proposed change

Add a **three-tab interface** to the existing `SectionComparePanel`, mirroring LegacyLens's feature-mode pattern (LegacyLens has four: explain / dependencies / documentation / translate). PiedPiper's three:

1. **"Why these are similar"** — LLM-generated paragraph + structured citations grounded in the criteria + timestamps.
2. **"Make mine more distinctive"** — LLM-generated 2-3 bullet creator-feedback advice, each tied to the specific criterion that drove the match.
3. **"Visual match"** — side-by-side spectrograms of the matched 10-second windows (query top, catalog match bottom), so users who can't trust their ears get evidence they can see. No LLM in this tab.

Tabs lazy-load: clicking fires the request, shows a "generating…" skeleton, then renders. The cold path (`/neighbors`) stays exactly as it is — fast, deterministic, no LLM dependency.

### User-resolved decisions (do not re-litigate; flag if you think they're wrong)

- **LLM provider: OpenAI GPT-4o-mini.** $0.0001/request, ~1-3 s latency. Selected over HF Inference (free Mistral 7B, weaker generation) and Claude Haiku (more expensive than GPT-4o-mini without clear quality advantage).
- **Three tabs, not four.** The user explicitly chose this over a four-mode "Reference comparison" option; said the four-tab UI gets too crowded in the row-expansion panel.
- **Pinecone is NOT introduced.** At 155 catalog tracks NumPy matmul beats Pinecone on latency. The README will frame PiedPiper as "RAG without a vector DB" — honest at this scale.

### Patterns explicitly copied from LegacyLens (`/Users/rajatarora/Gauntlet/LegacyLens`)

- **System prompt with citation requirement** (LegacyLens `llm.py:8-87`). PiedPiper version: "You are PiedPiper, an expert assistant for explaining acoustic similarity between music tracks. Cite specific tracks + timestamp ranges + criteria values. Never invent track names. Only reference tracks in the provided context."
- **`=== Match N: <metadata> ===` source-header format** (LegacyLens `llm.py:90-106`). PiedPiper version: `=== Match N: "<title>" by <artist> [match window: query <q_start>-<q_end> ↔ track <c_start>-<c_end>] (cosine <X>, tempo agreement <Y>, key agreement <Z>, harmonic <H>, timbre <T>) ===`. No raw audio goes to the LLM — only structured retrieval metadata.
- **Score-badge chunk cards** (LegacyLens `templates/index.html:753-801`). PiedPiper's `NarrativeBlock` mirrors the visual: small monospace header with cosine badge, body with the prose, footer with citation chips.
- **Semantic cache** (LegacyLens `api.py:124-159`). Simplified for PiedPiper: cache key is `hash((trackId, criteria payload, mode))`, no embedding-cosine match needed because the criteria payload is the canonical form for this specific match.
- **Lazy-load + streaming**. PiedPiper v1 is synchronous JSON (POST `/narrative` returns full payload); streaming via SSE is queued for v2 if latency feels slow in practice.
- **"View Full Track" modal**. LegacyLens has a "view file with highlighted lines" modal; PiedPiper's equivalent is queued for v2 (open full 30-second preview, highlight the matched 10-second window on a waveform).

---

## Critical files

### Backend (Commit A)

- **`backend/backend/rag_narrative.py`** (new) — OpenAI client, three system prompts (one per mode), prompt builders, structured-output enforcement (`response_format={"type": "json_object"}`), semantic cache.
- **`backend/backend/api.py`** — add `POST /narrative` endpoint that takes `{trackId, mode}` + the existing `/neighbors`-derived context payload. No changes to `/neighbors` itself.
- **`backend/tests/test_rag_narrative.py`** (new) — prompt-builder + cache-key + mock-OpenAI integration tests. No real API spend in tests.
- **`backend/pyproject.toml`** and **`deploy/hf_space/requirements.txt`** — add `openai>=1.40`.
- **HF Space** — `OPENAI_API_KEY` added as a secret via the Space settings.

### Frontend (Commit B)

- **`quality-scorer/src/components/SectionComparePanel.jsx`** — replace the current flat layout (timestamp strip + snippet players + criteria table) with a three-tab interface: "Why similar" / "Make mine distinctive" / "Visual match". Each tab lazy-loads on first click.
- **`quality-scorer/src/components/NarrativeBlock.jsx`** (new) — renders the LLM JSON. Shows the prose body + a citation footer with chips that, when clicked, scrub the snippet players to the cited time range.
- **`quality-scorer/src/components/SpectrogramCompare.jsx`** (new) — WaveSurfer.js Spectrogram plugin rendering the matched 10-second windows. Top half = query (from `queryFile` already plumbed via `URL.createObjectURL`), bottom half = catalog match (via `audioUrlFor(track)`).
- **`quality-scorer/src/lib/api.js`** — add `fetchNarrative(trackId, mode, contextPayload)`.
- **`quality-scorer/package.json`** — add `wavesurfer.js` dep (~50 KB bundle add).

### Docs (Commit C)

- **`docs/decisions/0005-rag-narrative-and-visual-match.md`** (new ADR) — locked design: per-mode prompt rationale, why GPT-4o-mini over Mistral/Claude Haiku, why no Pinecone, cache key shape, what we DO NOT claim (the LLM does not see audio).
- **`README.md`** — "Key engineering decision" section gets a paragraph naming the RAG architecture with explicit "RAG without a vector DB at this scale" framing.

---

## What the plan deliberately does NOT do

- Does not add Pinecone or any vector DB.
- Does not change MuQ-MuLan, the criteria layer, or the retrieval pipeline.
- Does not pass audio bytes to the LLM.
- Does not add LLM generation to `/neighbors` itself; the narrative is a separate lazy endpoint.
- Does not add streaming, the "View Full Track" modal, or a fourth "Reference comparison" mode in v1.

---

## Review questions for Codex

Please answer each directly. Mark each ⭐ for "I'd push back on this" or ✓ for "looks right."

1. **Is the three-tab interface the right shape?** Specifically: should "Visual match" be a third tab, or would it work better as a permanent visible block above the tabs (i.e., always-on visualization + two LLM-driven tabs)? Argue both sides.

2. **Is the `/narrative` endpoint design correct?** Specifically: should it take the full `/neighbors` response context as input, or should the backend look up the catalog track + criteria internally given just `(trackId, queryFingerprint)`? Trade-off: client-passes-context is simpler but lets the client edit the context, which has cost implications. Server-side lookup means the client doesn't need to round-trip large payloads.

3. **Is "no Pinecone" defensible?** Specifically: at 155 tracks, is there ANY argument for introducing a vector DB now (e.g., to set up the infrastructure for catalog growth later)? Or is "stick with NumPy, frame it as RAG-without-VectorDB" the engineering-honest call?

4. **Is the semantic cache design sound?** Specifically: cache key is `hash((trackId, criteria payload, mode))`. Is that stable across (a) JSON key ordering changes in the criteria, (b) floating-point precision of the agreement scores, (c) re-runs of the catalog ingest where the underlying numbers shift slightly? If any of these would invalidate cache keys, the cost story breaks.

5. **Is the prompt-design pattern from LegacyLens (cite tracks + timestamps + criteria values, never invent track names, only reference provided context) sufficient for PiedPiper's domain?** Specifically: LegacyLens's domain has stable canonical names (LAPACK routine names like DGESV are unambiguous). PiedPiper has track titles that can be ambiguous ("Take On Me" exists in many recordings). Should the prompt require the LLM to cite the `trackId` (`tier1:itunes:380907765`) in addition to the human-readable title? Trade-off: more disambiguation vs more visual noise in the rendered narrative.

6. **Is the "Visual match" tab actually useful, or is the criteria block sufficient?** The user explicitly asked for this because "sometimes listening people don't have great ears so a visual depiction is better." If the criteria block already shows tempo / key / harmonic agreement bars, is a spectrogram diff redundant — or genuinely adding the next layer of evidence? Argue for what the spectrogram view SHOULD highlight that the criteria bars miss.

7. **Is the OpenAI cost story honest?** At demo traffic (~200-500 narrative requests/month during the warm-intro window) and ~$0.0001/request, the monthly bill is single-digit cents. But if the cache misses (e.g., every page reload regenerates), is that still true? What's the worst-case-cost story Codex would tell the user before they accept this commit?

8. **Anything missing from the plan that would block a senior reviewer at Suno from taking PiedPiper seriously after this lands?** Specifically: any obvious omission, weak narrative, scope gap, or unverified claim that would make the warm intro land worse than the current state of the project (which already has the criteria layer + verification harness + ADR-0001 through ADR-0004).

---

## How to return the review

Write a short markdown doc — `factory/artifacts/CODEX_RAG_NARRATIVE_PLAN_REVIEW_RESPONSE.md` — with:

- One-line verdict per review question (1–8 above).
- Specific concrete changes you'd push back on, if any (file path + the change you'd want).
- Anything you noticed that the plan didn't mention that should be added or removed.
- Under 500 words total. Tight, not exhaustive.

If you approve the plan as written, say so plainly and Claude will start Commit A. If you want changes, list them by review-question number and Claude will revise before implementing.
