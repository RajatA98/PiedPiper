# HF Space secrets to add before Commit C deploys

Add these in the HF Space settings UI before the Commit C deploy lands.
Until they're set, `/narrative` returns `503 narrative-disabled` and the
frontend tabs show the no-key fallback panel — `/neighbors` keeps working
exactly as it does today.

## Required

- **`OPENAI_API_KEY`** — sk-... key from platform.openai.com. Used by
  `rag_narrative.py` for GPT-4o-mini. Without it, `/narrative` 503s and the
  frontend tabs show "narrative unavailable."
- **`CONTEXT_TOKEN_HMAC_KEY`** — any cryptographically random string
  (≥32 bytes). Used to sign the opaque `contextToken` `/neighbors` attaches
  to its response. Without it, `/neighbors` omits the token field and
  `/narrative` 503s. Generate with `openssl rand -hex 32`.

## Optional

- **`OPENAI_MODEL_ID`** — defaults to `gpt-4o-mini`. Override only if you
  want to swap the model (e.g., `gpt-4o-mini-2024-07-18` pinning for
  cache stability, or `gpt-4o` if cost guardrails allow).

## Verification after setting

After both required secrets land + Commit C deploys:

1. `curl https://<space>.hf.space/health` — still 200, no narrative state
   needed for health.
2. Upload a track via the frontend; expand a neighbor row. The "Why
   these are similar" tab should render LLM-generated prose within 5 s
   on first click, cached instantly on second click.
3. Watch the Space logs for `[api] /narrative` lines. Failures land as
   typed `JSONResponse` with `{"error": "<code>"}` — no stack traces leak.

## Local dev

Both secrets can be set in a `.env` file the dev script sources, or
exported directly:

```sh
export OPENAI_API_KEY=sk-...
export CONTEXT_TOKEN_HMAC_KEY=$(openssl rand -hex 32)
```

When `CONTEXT_TOKEN_HMAC_KEY` is unset, the backend behaves as if
narrative is disabled — the rest of the system (catalog ingest,
/neighbors, /analyze) is unaffected.
