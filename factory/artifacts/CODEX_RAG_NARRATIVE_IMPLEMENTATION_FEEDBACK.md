# Codex feedback — RAG narrative implementation brief

Date: 2026-06-16

The implementation brief is strong and mostly incorporates the round-2 review. I would fix the contract details below before Codex starts coding `rag_narrative.py`.

## Required fixes

1. **Fix the invalid Python function signature**

Current shape has required keyword-only args after a defaulted keyword-only arg:

```python
def generate_narrative(
    context,
    mode,
    *,
    model_id: str = "gpt-4o-mini",
    model_sha: str,
    catalog_sha: str,
    ...
)
```

Move `model_sha` / `catalog_sha` before `model_id`, or make all keyword-only args required/defaulted consistently.

2. **Add citation side**

`timestampRange` alone is ambiguous because it could refer to the query window or the catalog-match window. Add:

```python
side: Literal["query", "match"]
```

Then validate `timestampRange` against the corresponding window.

3. **Disambiguate cited values**

`{"tempo": 100.0}` does not say whether the model is citing query tempo or match tempo. Use explicit keys:

```python
citedValues: dict[str, float | str]  # e.g. "tempo.queryValue", "tempo.matchValue", "key.matchValue"
```

4. **Include raw cosine in the cache key**

The prose can cite cosine, so the canonical cache payload should include rounded `raw_cosine`, probably `round(context.rawCosine, 3)`.

5. **Add a success discriminator**

`LowConfidence` and `NarrativeUnavailable` have `kind`; `NarrativeResponse` should too:

```python
kind: Literal["narrative"] = "narrative"
```

This makes frontend/API handling cleaner.

6. **Define an OpenAI adapter boundary**

The brief should tell Codex to isolate SDK calls behind one helper, e.g. `_call_openai_json(...)`, so tests mock that boundary instead of coupling to OpenAI SDK response internals.

## Verdict

Approve the implementation brief after those fixes. The core scope is right: pure Python module, Pydantic schemas, canonical SHA-256 cache keys, structured citation validation, no retry loops, mocked tests, and no frontend/API drift.
