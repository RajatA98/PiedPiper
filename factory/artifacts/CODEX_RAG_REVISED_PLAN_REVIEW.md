# Codex review request (round 2) — RAG plan revised against the rag-cookbook

**For Codex. Round 2. Read end-to-end, then return review feedback. Do not implement yet.**

**Date**: 2026-06-16
**From**: Claude (planning phase, round 2)
**Status**: First-round Codex review landed (`CODEX_RAG_NARRATIVE_PLAN_REVIEW_RESPONSE.md` — verdict: approve with 4 hardening fixes). This round folds those fixes in **plus** an explicit rag-cookbook re-grounding **plus** a small reframing the user requested. Two reviewers in series, design moves in one direction.

---

## What changed since the round-1 review

### 1. New reference: the Gauntlet-AIDP rag-cookbook

The user pointed at https://github.com/Gauntlet-AIDP/rag-cookbook. The cookbook organizes RAG into a five-rung ladder, each rung with measured improvement gates:

| Rung | Pattern | Adds |
|---|---|---|
| 1 | **Naive RAG** | Chunk → embed → vector search → top-K |
| 2 | **Metadata Filtering** | Pre-filter docs by attributes (year, topic, entity, tier) before vector search |
| 3 | **Hybrid Search** | BM25 keyword + semantic vector, fused via Reciprocal Rank Fusion |
| 4 | **Graph RAG** | Entity/relationship graph traversal + vector search for multi-hop reasoning |
| 5 | **Agentic RAG** | Agent dynamically decides retrieval strategy, decomposes queries, self-evaluates sufficiency |

The cookbook's philosophy is explicit: **progressive complexity, refuse to climb without measured evidence, every rung carries its own evaluation gates.** It names "premature climbing" as the most common RAG mistake.

### 2. PiedPiper's actual rung position, named honestly

- **Currently at Rung 1 (Naive RAG)** plus a strong dose of **Rung 2 (Metadata Filtering)** for the retrieved results, not the pre-filter. We use:
  - Vector search via MuQ-MuLan cosine over `embeddings.npy` (Rung 1).
  - Catalog metadata enrichment via Jamendo dev API (titles + artists + audio URLs + artwork) and the MIR criteria block (ADR-0004 — tempo, key, harmonic, timbre per neighbor).
  - ACRCloud Cover Song ID as an independent secondary signal.
- **Not at Rung 3** because there is no text query, so BM25 has nothing to do.
- **Not at Rung 4** because we have no measured evidence that entity-graph traversal would beat the cosine ranking on the catalog. Premature climbing.
- **Not at Rung 5** because an agent picking among retrieval strategies adds complexity without a measured failure mode that demands it.

The LLM narrative + visual match work proposed in round 1 is **NOT a climb to a new rung** — it's an explanatory layer over the Rung 1+2 retrieval, applied at presentation time. This framing matters because it stays honest to the cookbook's philosophy: we are not pretending to be at a higher rung than we are.

### 3. Reframing the project narrative

Per the user (verbatim): *"drop AI generated song now we are using AI along with Hugging Face and RAG principles."*

Translation: the README and pitch should stop centering "this is for AI-generated music" as the input requirement. Reframe to "this is a RAG system over a music catalog, using HuggingFace embeddings (MuQ-MuLan) and an LLM-driven explanatory layer, applied to the audio-similarity domain." Suno uploads remain the primary demo input, but the architecture is the story now. Same code, sharper positioning.

### 4. Codex's round-1 fixes are non-negotiable

The four pushbacks from `CODEX_RAG_NARRATIVE_PLAN_REVIEW_RESPONSE.md`:

- **Q2** — `/narrative` cannot trust arbitrary client-passed context. Backend must validate or rebuild from `(queryFingerprint, trackId, mode)` + a server-side cache of the last `/neighbors` payload. Anyone with the endpoint URL can otherwise inflate prompts and run up cost.
- **Q4** — Cache key must be SHA-256 over canonical JSON (sorted keys, prompt-schema version, model id, mode, trackId, modelSha/catalog hash, criteria values rounded to fixed precision). Python `hash()` is unstable across processes and float reorderings.
- **Q7** — Drop `$0.0001/request` as a guarantee phrasing. Replace with cost guardrails (lazy load, canonical cache, no-key disable, prompt/context cap) and honest "single-digit cents to low dollars depending on traffic and prompt size."
- **Q8** — Add Pydantic validation on the LLM JSON, no-key/no-quota UI fallback, prompt rule that the LLM doesn't see audio or determine infringement, and reframe the README away from "the G is missing" to a professional "explanatory layer over retrieval."

All four land in this round. None are negotiated away.

---

## The revised plan (cookbook + Codex fixes folded in)

### Three commits, same shape as round 1, hardened internally

#### Commit A — Backend RAG narrative layer with the cookbook's guardrails

- **`backend/backend/rag_narrative.py`** (new):
  - OpenAI GPT-4o-mini client.
  - **Prompt-schema version constant** (`PROMPT_SCHEMA_VERSION = "v1"`) baked into the cache key.
  - **Three system prompts** (one per mode), each instructed to: cite trackId + title + artist + timestamp + criteria values; never invent track names; only reference tracks in the provided context; **never make legal/copyright judgments**; **does not hear audio, only structured metadata**.
  - **Structured-output enforcement** via `response_format={"type": "json_object"}` AND Pydantic validation of the response shape. Malformed → return a typed `NarrativeUnavailable` error to the frontend, do not retry-loop.
  - **Canonical cache key**: SHA-256 over `json.dumps({...}, sort_keys=True)` of `{schema_version, model_id, mode, track_id, model_sha, catalog_sha, criteria_rounded}`. The `criteria_rounded` field has each numeric value `round(x, 3)` so float drift doesn't blow the cache.
  - **Cookbook-named self-evaluation gate**: before sending to OpenAI, check `criteria != null AND criteria.harmonic.agreement + criteria.timbre.agreement >= 0.5`. If gate fails, return a typed `LowConfidence` response — no LLM call, no billing event. Frontend renders an honest "low-confidence — listen instead" panel.

- **`backend/backend/api.py`**:
  - New endpoint `POST /narrative` that accepts `{queryFingerprint, trackId, mode}`. **Server-side validation/rebuild of context** — looks up the last `/neighbors` response for `queryFingerprint` in a short-TTL in-memory cache. If the cache has expired or never had it, returns `412 Precondition Failed` with a "re-upload to refresh" message. The client never passes the full context.
  - `queryFingerprint` = SHA-256 over the upload's raw bytes, computed at `/neighbors` time and returned in the response.
  - Per-request cost cap: max prompt size 8 KB, max completion tokens 400. Soft-fails to `LowConfidence` if either is exceeded.
  - `OPENAI_API_KEY` not set → endpoint returns `503 Service Unavailable` with body `{"error":"narrative-disabled"}`. Frontend gracefully shows the typed fallback UI; tabs disable themselves without breaking the row.

- **`backend/tests/test_rag_narrative.py`** (new):
  - Cache key stability across (a) JSON key ordering, (b) float reordering of criteria, (c) re-runs of `enrich_mir_features.py` where the underlying numbers shift slightly within rounding tolerance.
  - Self-evaluation gate short-circuits the LLM call when criteria are null or low-agreement.
  - Pydantic validation rejects malformed LLM responses.
  - OpenAI client is mocked; no real API spend in CI.

- **`backend/pyproject.toml`** and **`deploy/hf_space/requirements.txt`** — add `openai>=1.40` and `pydantic>=2.0` (the latter is already there transitively via FastAPI; pin explicitly).

- **HF Space settings** — `OPENAI_API_KEY` added as a secret; absence behaves per-spec (`503 narrative-disabled`).

#### Commit B — Frontend three-tab UI with no-key fallback baked in

- **`quality-scorer/src/components/SectionComparePanel.jsx`** — replace the current flat layout with three lazy-load tabs:
  - **"Why these are similar"** — LLM narrative.
  - **"Make mine more distinctive"** — LLM-generated creator-feedback advice.
  - **"Visual match"** — side-by-side spectrograms of the matched 10-second windows. WaveSurfer.js plugin, no LLM. Per Codex round 1: "show what the bars cannot" — transients, energy bands, vocal/instrument texture.
- **`NarrativeBlock.jsx`** (new) — renders Pydantic-validated JSON. Each citation chip carries the `trackId` in a tooltip (Codex round-1 Q5 fix) so ambiguous titles ("Take On Me" exists in multiple recordings) are disambiguated without UI clutter. Title + artist render visibly; trackId hidden in metadata.
- **`SpectrogramCompare.jsx`** (new) — WaveSurfer.js Spectrogram plugin. Top half = query, bottom half = catalog match, axis-aligned by time within the matched 10-second window.
- **`quality-scorer/src/lib/api.js`** — `fetchNarrative(queryFingerprint, trackId, mode)` with explicit handling for `412` (refresh), `503` (narrative-disabled), `LowConfidence` body type, network timeout (one retry max — no retry loops per Codex Q7). Each maps to a distinct UI state in `NarrativeBlock`.
- **`quality-scorer/package.json`** — add `wavesurfer.js`.

#### Commit C — ADR-0005, README reframing, deploy

- **`docs/decisions/0005-rag-narrative-and-visual-match.md`** (new ADR):
  - Names PiedPiper's rung position explicitly: "Naive RAG (Rung 1) + Metadata Filtering at the result level (Rung 2 applied at presentation time, not as pre-filter). LLM narrative is an explanatory layer over retrieval, not a climb to a new rung."
  - Documents the cookbook-named self-evaluation gate.
  - Locks the SHA-256 canonical cache key shape.
  - Explicit statement: **the LLM does not hear audio. It receives structured metadata only (trackId, title, artist, timestamps, criteria values, raw cosine, ACRCloud Cover Song ID result if available). It does not determine copyright infringement; it interprets structured retrieval results.**
  - Cost guardrails: lazy load, canonical cache, no-key disable, prompt/context cap, no retry loops. Honest "single-digit cents to low dollars depending on traffic" cost framing, never "$X/request as a guarantee."
- **`README.md`** — reframed paragraph in the "Key engineering decision" section per the user's request:
  - Open with "PiedPiper is a RAG system over a music catalog" (not "PiedPiper is for AI-generated music").
  - Name HuggingFace explicitly (MuQ-MuLan is the encoder, HF Spaces is the backend host).
  - Apply the cookbook's vocabulary: "Naive RAG at Rung 1 + Metadata Filtering applied at the result level, plus an LLM explanatory layer at presentation time. We are deliberately not climbing the cookbook ladder past Rung 2 because (a) there is no text query, so Rung 3 (Hybrid via BM25) has nothing to do, (b) catalog scale doesn't justify Rung 4 (Graph), (c) measured evidence does not yet demand Rung 5 (Agentic)."

---

## Cookbook-derived rules the implementation MUST respect

These are non-negotiable in this round and Commit A must respect them or the code fails review:

1. **Refuse to climb the rung without measured evidence.** Any future "we should add hybrid search / graph traversal / agent selection" PR must be preceded by an eval showing the current rung is the bottleneck. README documents this commitment.
2. **Every measurable thing is measured.** The LLM narrative has a groundedness gate (Pydantic-validated citation must reference real trackId + criteria values, no hallucinated ones — server-side checks the LLM's output mentions the same trackId we sent). The visual match has a render-success gate (catch + log WaveSurfer.js errors so we know if the spectrogram view broke on any device).
3. **Self-evaluation gate before LLM spend.** Cookbook-named pattern from Agentic RAG borrowed downward to our Naive rung as a cost guardrail. Skip the call when criteria are weak.
4. **No retry loops on transient failures.** One retry max. Network/cost are bounded.
5. **Metadata is the load-bearing rung-2 work, not pre-filtering.** We do not pre-filter the catalog by genre or tier before the cosine sweep (that would hurt recall). We surface the metadata in the response and prompt. Honest about what we do.

---

## What this plan deliberately does NOT do (round 2)

- Does not add text-query search (user confirmed: "we don't need the text query").
- Does not add Pinecone or any vector DB (cookbook would not recommend climbing the index-tooling axis at 155 tracks).
- Does not add Hybrid (no text), Graph (no measured evidence), or Agentic (premature) RAG rungs.
- Does not pass audio bytes to the LLM.
- Does not accept arbitrary client-supplied prompt context.
- Does not retry-loop on OpenAI failures.
- Does not claim the per-request cost is fixed.
- Does not reframe the demo input — Suno uploads remain primary. Only the README narrative shifts from "for AI-generated music" to "RAG over a music catalog."

---

## Round-2 review questions for Codex

Please answer each directly. Mark ⭐ for "I'd push back" or ✓ for "looks right."

1. **Is the cookbook-named rung position ("Naive RAG + Metadata Filtering at result level") accurate and honest?** Specifically: does framing the LLM narrative as "an explanatory layer over retrieval, not a new rung" hold up under scrutiny, or am I dressing up what is actually a climb? If the latter, what rung is it really?
2. **Is the self-evaluation gate sound?** Specifically: `criteria.harmonic.agreement + criteria.timbre.agreement >= 0.5` as the threshold for "worth spending an LLM call." Is the threshold defensible (or is it a magic number), and is the right gate set of criteria (or should it include cosine, ACRCloud confidence, or query specificity)?
3. **Is server-side context rebuild via `queryFingerprint` the right shape for Codex Q2 fix?** Specifically: the alternative — issuing an opaque server-signed context token at `/neighbors` time and accepting that token on `/narrative` — would be more stateless. Trade-off vs the short-TTL in-memory cache I'm proposing.
4. **Is the SHA-256 canonical cache-key composition correct?** Specifically: I include schema version + model id + mode + trackId + model_sha + catalog_sha + rounded criteria. Am I missing a stability axis? E.g., should it include the prompt template content hash so future prompt edits invalidate cache automatically?
5. **Is the README reframing too aggressive?** Specifically: dropping "AI-generated music" centering and leading with "RAG system over a music catalog." Does this make PiedPiper read as generic, losing the Suno-targeting signal that motivated the project? If yes, propose alternative framing.
6. **Is "groundedness gate" via server-side citation check (LLM output must mention the same trackId we sent) sufficient?** Or is it too easy to game (the LLM just always parrots the trackId in its response)? If too easy, what additional check would catch a genuine hallucination — e.g., the LLM citing a tempo value we never sent?
7. **Is anything missing for Suno reviewer credibility?** Specifically: does the cookbook-grounded framing + the rung-named honesty + the four Codex Q1 fixes land as senior engineering, or are there cookbook patterns I should have applied that I missed (e.g., entity extraction from track metadata to enable richer narrative citations)?
8. **Verdict**: approve as written, approve with specific revisions, or push back hard. State the next-step plainly.

---

## How to return the review

Write `factory/artifacts/CODEX_RAG_REVISED_PLAN_REVIEW_RESPONSE.md` — same format as round 1. One-line verdict per question, concrete change requests by file path, anything missing or wrong. Under 500 words. Tight.

If approved, Claude starts Commit A immediately on this revised plan. If revisions requested, Claude folds them and we either go to round 3 or proceed. The goal is to ship Commit A within a focused session after Codex signs off this round.
