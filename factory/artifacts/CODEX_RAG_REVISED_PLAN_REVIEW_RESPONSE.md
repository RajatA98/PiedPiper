# Codex RAG Revised Plan Review Response

Date: 2026-06-16

1. ✓ **Rung framing is honest.** PiedPiper is Rung 1 retrieval plus result-level metadata grounding. The LLM narrative is presentation-time generation over retrieved evidence, not Hybrid/Graph/Agentic RAG. Say "metadata-grounded generation" rather than "Metadata Filtering" when precision matters, because no pre-filter happens.

2. ⭐ **Push back on the self-evaluation gate.** `harmonic + timbre >= 0.5` is a magic number and can wrongly suppress useful tempo/key explanations. Gate on context completeness, not musical confidence: require `criteria != null`, timestamp present, track metadata present, and at least one criterion with `agreement >= 0.55` OR `rawCosine >= thresholdDefault`. Let the narrative say "weak evidence" instead of hiding it.

3. ⭐ **Prefer opaque signed context token over `queryFingerprint` + TTL cache.** A short-TTL in-memory cache breaks across HF restarts, multiple workers, and page refreshes. Return a signed token from `/neighbors` containing fingerprint, allowed trackIds, model/catalog hashes, and expiry. `/narrative` accepts `{contextToken, trackId, mode}` and rebuilds/validates against token claims.

4. ✓ **Cache key shape is close.** Add `prompt_template_hash`, `response_schema_version`, `criteria_algorithm_version` or ADR-0004 version, and `queryFingerprint` if user-upload-specific criteria affect the output. Otherwise prompt edits and MIR-threshold changes can reuse stale prose.

5. ⭐ **README reframing is too aggressive as written.** Do not drop the Suno/AI-generated music center. Better: "PiedPiper is a RAG-style evidence layer for AI-generated music: MuQ-MuLan retrieves nearest catalog tracks, MIR metadata grounds the explanation, and an LLM narrates the evidence." That keeps the Head-of-Engineering hook while naming RAG.

6. ⭐ **TrackId-only groundedness is too weak.** Require citations as structured objects, not just prose mentions: `{trackId, timestampRange, criterionIds, citedValues}`. Server validates every cited criterion/value exists in the supplied context within tolerance. This catches hallucinated tempo/key/cosine claims.

7. ✓ **Credibility story is strong after revisions.** Missing addition: a tiny narrative eval fixture set. Add tests with mocked LLM outputs for valid, malformed, hallucinated criterion, wrong trackId, and low-context cases. This mirrors the cookbook's groundedness-eval discipline without API spend.

8. **Verdict: approve with revisions.** Fix Q2/Q3/Q5/Q6 before Commit A. Then implement backend first, with strict tests and no frontend dependency on live OpenAI behavior.

## Concrete Changes Requested

- `backend/backend/rag_narrative.py`: replace harmonic+timbre gate; add prompt/schema/criteria version hashes; validate structured citations against context.
- `backend/backend/api.py`: prefer signed `contextToken` from `/neighbors` over in-memory fingerprint cache.
- `docs/decisions/0005-rag-narrative-and-visual-match.md`: use "metadata-grounded generation" terminology and keep Suno/AI-generated music as the primary product context.
- `README.md`: use the RAG framing as engineering architecture, not a replacement for the Suno-focused pitch.
