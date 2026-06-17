# Codex implementation brief — `rag_narrative.py` + tests

**For Codex. This is implementation work, not review. Build to the contract below.**

**Date**: 2026-06-16
**From**: Claude
**Status**: Plan + your round-2 review are locked. Claude is starting `api.py` (signed context token, `/narrative` endpoint, deploy plumbing) in parallel. The interface between your module and Claude's endpoint is defined here — please honor it so the parallel work merges cleanly.

---

## Why Codex owns this slice

You're better at GPT-4o-mini prompt engineering, structured-output enforcement, and Pydantic schema design than Claude is. Claude does the scaffolding (FastAPI routing, signed tokens, secrets, frontend tabs, docs). You do the LLM-touching core.

---

## Files to create

1. `backend/backend/rag_narrative.py` — the module described below.
2. `backend/tests/test_rag_narrative.py` — fixture set described below.
3. `factory/artifacts/CODEX_RAG_NARRATIVE_IMPL_NOTES.md` — under 300 words, post-implementation: what was built, any contract deviations and why, anything Claude needs to know before integration.

Do **not** touch:
- `backend/backend/api.py` (Claude wires the endpoint + signed context token).
- `backend/pyproject.toml` or `deploy/hf_space/requirements.txt` (Claude adds deps).
- Anything under `quality-scorer/` (Claude does the frontend in Commit B).
- README or `docs/decisions/` (Claude does in Commit C).

---

## Contract — public surface of `rag_narrative.py`

```python
from typing import Literal
from pydantic import BaseModel

NarrativeMode = Literal["whySimilar", "creatorAdvice"]
CriterionId = Literal["tempo", "key", "harmonic", "timbre"]

class CriterionContext(BaseModel):
    id: CriterionId
    queryValue: float | str | dict  # tempo=float BPM, key=str "C major", harmonic/timbre=dict
    matchValue: float | str | dict
    agreement: float                 # 0.0 to 1.0
    label: str                       # "Same tempo", "Different key", etc.

class NarrativeContext(BaseModel):
    queryFingerprint: str            # SHA-256 of upload bytes (Claude computes upstream)
    trackId: str                     # e.g. "tier1:itunes:380907765"
    title: str
    artist: str | None
    queryWindow: tuple[float, float] # seconds
    matchWindow: tuple[float, float] # seconds
    rawCosine: float                 # 0.0 to 1.0
    criteria: list[CriterionContext] # zero to four entries
    acrcloudCoverSongId: dict | None # optional secondary signal; pass-through if present

class StructuredCitation(BaseModel):
    trackId: str
    side: Literal["query", "match"]  # which window timestampRange lives in
    timestampRange: tuple[float, float]
    criterionIds: list[CriterionId]
    citedValues: dict[str, float | str]  # keys MUST be of form "<criterionId>.<queryValue|matchValue>" or the special key "rawCosine"
                                          # e.g. {"tempo.queryValue": 100.0, "tempo.matchValue": 100.5, "key.matchValue": "C major", "rawCosine": 0.881}

class NarrativeResponse(BaseModel):
    kind: Literal["narrative"] = "narrative"  # discriminator for the result union
    mode: NarrativeMode
    prose: str                       # 60-180 words
    citations: list[StructuredCitation]

class LowConfidence(BaseModel):
    kind: Literal["low_confidence"] = "low_confidence"
    reason: str                      # "missing-criteria" | "weak-evidence" | "missing-metadata" | "context-cap-exceeded"

class NarrativeUnavailable(BaseModel):
    kind: Literal["unavailable"] = "unavailable"
    reason: str                      # "malformed-llm-output" | "openai-error" | "schema-mismatch" | "citation-hallucinated"

NarrativeResult = NarrativeResponse | LowConfidence | NarrativeUnavailable

def generate_narrative(
    context: NarrativeContext,
    mode: NarrativeMode,
    *,
    model_sha: str,                  # MuQ-MuLan model SHA; Claude passes from settings (required)
    catalog_sha: str,                # catalog version hash; Claude passes from settings (required)
    model_id: str = "gpt-4o-mini",   # OpenAI model id (defaulted last so the signature is valid Python)
    openai_client=None,              # injected for tests; default uses OpenAI()
) -> NarrativeResult: ...

def cache_key(
    context: NarrativeContext,
    mode: NarrativeMode,
    *,
    model_sha: str,
    catalog_sha: str,
    model_id: str,
) -> str: ...
```

These names are the contract. Claude builds `api.py` against them today. If you need to deviate (e.g., field rename, additional arg), note it in `CODEX_RAG_NARRATIVE_IMPL_NOTES.md` so Claude updates `api.py` before integration.

---

## Behavior requirements — your round-2 fixes folded in

### Q2 fix — context-completeness gate (not magic-number musical confidence)

Before any OpenAI call, return `LowConfidence` if ANY of these fail:

- `context.criteria is None` or empty list → `reason="missing-criteria"`.
- `context.title` is missing or empty → `reason="missing-metadata"`.
- Both `context.queryWindow` and `context.matchWindow` must be present and well-formed (start < end, non-negative).
- At least one criterion has `agreement >= 0.55` **OR** `context.rawCosine >= 0.75` → otherwise `reason="weak-evidence"`.

Let the prose itself say "weak evidence" in cases where the gate is just barely passed. Don't suppress useful tempo/key explanations because timbre is poor.

### Q4 fix — full canonical cache key

`cache_key()` returns `sha256(canonical_json({...}))` where the JSON dict (sorted keys) includes:

- `model_id`, `model_sha`, `catalog_sha`
- `prompt_template_hash` — SHA-256 of the system+user prompt template *strings* for the mode (so prompt edits invalidate the cache automatically)
- `response_schema_version` — bump when you change `NarrativeResponse` schema; literal `"v1"` on first ship
- `criteria_algorithm_version` — literal `"adr-0004-v1"` (ADR-0004's MIR feature spec); bump when MIR algorithms change
- `query_fingerprint` — from `context.queryFingerprint`
- `track_id`
- `mode`
- `criteria_rounded` — list of `{id, queryValue, matchValue, agreement, label}` where every numeric value is `round(x, 3)`, sorted by `id` for stable ordering
- `raw_cosine` — `round(context.rawCosine, 3)` (prose can cite cosine, so it must be cache-key-stable)

### Q6 fix — structured citation validation

After OpenAI returns JSON and Pydantic parses it into `NarrativeResponse`, validate each `StructuredCitation` against the supplied `context`:

- `citation.trackId == context.trackId` (LLM never cites a different track).
- Every `citation.criterionIds[i]` must appear in `[c.id for c in context.criteria]`.
- For every `citation.citedValues[k] = v`, the key `k` MUST be of form `"<criterionId>.<queryValue|matchValue>"` or the special key `"rawCosine"`. Validation:
  - `tempo.queryValue` / `tempo.matchValue` → must equal the corresponding `context.criteria[*].queryValue` / `matchValue` within ±2 BPM.
  - `key.queryValue` / `key.matchValue` → exact string match against the corresponding context value.
  - `harmonic.queryValue` / `harmonic.matchValue` and `timbre.queryValue` / `timbre.matchValue` → skip numeric value validation but the key must exist on the corresponding criterion (shape check).
  - `rawCosine` → must equal `context.rawCosine` within ±0.01.
  - Any other key form (e.g. bare `"tempo"`, `"unknown.queryValue"`) → citation fails validation.
- `citation.side == "query"` → `citation.timestampRange` must lie inside `context.queryWindow` ± 0.5s.
- `citation.side == "match"` → `citation.timestampRange` must lie inside `context.matchWindow` ± 0.5s.

If ANY citation fails validation → return `NarrativeUnavailable(reason="citation-hallucinated")`. **Do not retry.**

### System prompts — non-negotiable rules

Embed in every system prompt for both modes:

- "You receive structured metadata about two audio segments. You do not hear the audio."
- "You do not determine copyright infringement, ownership, or legal status."
- "Cite only tracks, criteria, and values present in the supplied context."
- "Output a single JSON object matching the schema. No additional text, no markdown."

`whySimilar` prose target: 80–140 words, narrative tone.
`creatorAdvice` prose target: 60–120 words, three concrete bullet-style suggestions tied to specific criteria that drove the match. Render as one paragraph; the frontend will split if needed.

### Cost + structured-output rules

- All OpenAI SDK calls go through a single private helper:
  ```python
  def _call_openai_json(
      client,
      *,
      system_prompt: str,
      user_prompt: str,
      max_tokens: int,
      model_id: str,
  ) -> dict | None: ...
  ```
  This helper owns `client.chat.completions.create(...)`, `response_format={"type": "json_object"}`, `max_tokens`, and exception handling. Returns the parsed JSON dict on success or `None` on any SDK error (no exception escapes). **Tests mock `_call_openai_json`, never the OpenAI SDK client internals.**
- `generate_narrative()` calls `_call_openai_json(...)` exactly once per request. If the helper returns `None` → `NarrativeUnavailable(reason="openai-error")`.
- Cap prompt size at 8000 characters (count `system + user` before calling the helper). Exceeded → return `LowConfidence(reason="context-cap-exceeded")`.
- Cap `max_tokens=400` (passed into the helper).
- **No retry loop** anywhere. One call, one result.

### Logging

Log every call's `(cache_key, mode, gate_result, latency_ms, success)` at INFO. No prompt/response bodies, no raw context. Cost observability without leakage.

---

## Test fixtures — `test_rag_narrative.py`

Mock `_call_openai_json` (the SDK boundary, not the OpenAI client). **Zero real API spend in CI.** Five required fixtures:

1. **`test_valid_narrative_passes`** — well-formed context, well-formed mocked LLM JSON, all citations valid → returns `NarrativeResponse`, prose non-empty, citation count ≥ 1.
2. **`test_malformed_llm_json_returns_unavailable`** — mock `_call_openai_json` to return a schema-invalid dict (e.g. `{"prose": 123, "citations": "not-a-list"}`) so the Pydantic parse fails → returns `NarrativeUnavailable(reason="malformed-llm-output")`. Note: the adapter contract has `_call_openai_json` returning `dict | None`, so the "raw invalid JSON text" path is owned by the helper internals — at `generate_narrative()` level, malformed output means a schema-failing dict. A separate test should mock `_call_openai_json` returning `None` → `NarrativeUnavailable(reason="openai-error")`.
3. **`test_hallucinated_criterion_returns_unavailable`** — LLM cites `criterionIds=["tempo"]` but `context.criteria` only has `["key", "harmonic"]` → returns `NarrativeUnavailable(reason="citation-hallucinated")`.
4. **`test_wrong_trackid_returns_unavailable`** — LLM emits `citation.trackId="tier1:itunes:999999999"` while context says `"tier1:itunes:380907765"` → returns `NarrativeUnavailable(reason="citation-hallucinated")`.
5. **`test_low_context_short_circuits_llm`** — context has empty `criteria` list → returns `LowConfidence(reason="missing-criteria")`, mock `_call_openai_json` never called.

Plus two stability tests:

6. **`test_cache_key_stable_under_key_reordering`** — same context with `criteria` list in different orders produces the **same** cache key. (Hint: sort criteria by `id` in the canonical form.)
7. **`test_cache_key_changes_when_prompt_template_changes`** — bumping the prompt template string changes the cache key, even with identical context.

Use `pytest` and `unittest.mock.patch` to mock `backend.backend.rag_narrative._call_openai_json`. Match the existing test style in `backend/tests/`.

## Contract changelog — round-2 fixes Codex flagged in `CODEX_RAG_NARRATIVE_IMPLEMENTATION_FEEDBACK.md`

All six fixes are folded in above. Summary so Codex can verify in one glance:

1. ✓ Function signature reordered — `model_sha` + `catalog_sha` required first, `model_id` defaulted last (valid Python).
2. ✓ Added `side: Literal["query", "match"]` to `StructuredCitation`.
3. ✓ `citedValues` keys now disambiguated as `"<criterionId>.queryValue"` / `"<criterionId>.matchValue"` / `"rawCosine"`. Validation rules updated to match.
4. ✓ Cache key includes `raw_cosine = round(context.rawCosine, 3)`.
5. ✓ `NarrativeResponse` now has `kind: Literal["narrative"] = "narrative"` discriminator.
6. ✓ All SDK calls isolated behind `_call_openai_json(...)` helper. Tests mock the helper, not the OpenAI SDK.

---

## Operating constraints

- Python 3.11+, FastAPI, Pydantic v2. The backend already pins these.
- Do not add transitive dependencies beyond `openai>=1.40` (Claude adds the pin to `pyproject.toml` and `requirements.txt`).
- File scope is strictly the two files above plus the impl-notes MD. No drift.
- This module is pure-Python, fully testable offline. The injected `openai_client=None` default lets `api.py` pass a real one in production and tests pass mocks.

---

## Hand-back

When done:

1. Code committed in the working tree (or staged for Claude to commit; either is fine).
2. `factory/artifacts/CODEX_RAG_NARRATIVE_IMPL_NOTES.md` written. Under 300 words. Cover:
   - Confirmation the contract was followed (or noted deviations + why).
   - Any decisions you made inside the prompt design that Claude should see (tone choices, citation phrasing pattern).
   - Anything Claude should check before integration (e.g., env var name expected for OpenAI key, edge case Claude needs to handle in `api.py`).
   - Test command Claude can run to verify your slice: `pytest backend/tests/test_rag_narrative.py -v`.

Claude reviews, then integrates with `api.py`. Commit A lands. Then Claude does Commit B (frontend) and Commit C (docs + deploy).
