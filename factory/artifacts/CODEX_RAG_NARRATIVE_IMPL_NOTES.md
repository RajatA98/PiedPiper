# Codex RAG narrative implementation notes

Date: 2026-06-16

Implemented the scoped backend narrative core in `backend/backend/rag_narrative.py` plus offline tests in `backend/tests/test_rag_narrative.py`.

The public contract from `CODEX_RAG_NARRATIVE_IMPLEMENTATION.md` was followed: Pydantic models, `generate_narrative()`, `cache_key()`, `NarrativeResponse` / `LowConfidence` / `NarrativeUnavailable`, structured citations with `side`, disambiguated `citedValues`, canonical SHA-256 cache keys, prompt/schema/criteria versioning, raw-cosine cache participation, and `_call_openai_json(...)` as the single SDK adapter.

Prompt behavior: both modes explicitly say the LLM receives structured metadata only, does not hear audio, does not determine legal/copyright status, and must output one JSON object. `whySimilar` asks for evidence explanation; `creatorAdvice` asks for concrete changes tied to cited criteria.

Claude integration notes:

- `api.py` can pass a real OpenAI client or leave `openai_client=None`; the adapter lazily imports `OpenAI`.
- If `_call_openai_json` returns `None`, the result is `NarrativeUnavailable(reason="openai-error")`.
- Context gating returns `LowConfidence` before any LLM call for missing criteria, missing metadata/window shape, weak evidence, or prompt size cap.
- Citation validation rejects wrong track IDs, unsupported criterion IDs, invalid cited-value keys, out-of-window timestamps, and hallucinated numeric/string values.

Verification:

```bash
cd backend
.venv/bin/python -m pytest -q tests/test_rag_narrative.py
.venv/bin/python -m pytest -q tests/test_rag_narrative.py tests/test_mir_features.py
.venv/bin/python -m pytest -q tests/test_neighbors_endpoint.py -k "not slow"
```
