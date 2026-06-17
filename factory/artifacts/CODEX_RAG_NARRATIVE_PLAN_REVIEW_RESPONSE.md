# Codex RAG Narrative Plan Review Response

Date: 2026-06-16

1. ✓ **Three-tab shape is right.** Keep "Visual match" as the third tab, not always-on; permanent spectrograms make the expanded row heavy before the user asks for visual evidence. Lazy-load both LLM and spectrogram views.

2. ⭐ **Push back on client-passed full context.** `POST /narrative` should not trust arbitrary `/neighbors` payloads. Accept a signed/server-issued context id, or `{queryFingerprint, trackId, mode}` plus a server-side cache of the last `/neighbors` result. Rebuild or validate LLM context server-side before spending tokens.

3. ✓ **No Pinecone is defensible.** At 155 tracks, adding a vector DB would be architecture theater. "RAG without a vector DB at this scale" is exactly the honest engineering story. Revisit around 10k+ tracks or when catalog mutation/query concurrency creates operational pressure.

4. ⭐ **Cache key needs canonicalization.** Do not use raw `hash((trackId, criteria payload, mode))`. Use SHA-256 over canonical JSON: sorted keys, prompt/schema version, model id, mode, trackId, modelSha/catalog hash, and criteria values rounded to fixed precision. Otherwise float drift/key-order changes create misses.

5. ✓ **Prompt pattern is sufficient if IDs are included.** LLM context should include `trackId`, source, title, artist, timestamps, raw cosine, and criteria labels/values. Render title/artist; keep `trackId` in citation metadata/tooltips so ambiguous titles are disambiguated without clutter.

6. ✓ **Visual match is useful if it shows what bars cannot.** Highlight time-local structure: transients, energy bands, vocal/instrument texture, and matched 10-second windows. Criteria bars summarize; spectrograms show evidence behind timbre/harmonic claims.

7. ⭐ **Cost story is honest directionally, but do not quote `$0.0001/request` as a guarantee.** Say "single-digit cents to low dollars for demo traffic, depending on prompt size/cache misses/model pricing." Add limits: lazy-load, canonical cache, no-key disable, prompt/context cap.

8. ⭐ **Missing blocker-level details:** add JSON schema/Pydantic validation, no-key/no-quota UI fallback, and a prompt rule that the LLM does not hear audio or determine infringement. Avoid "the G is missing" in public README; frame this as an explanatory layer over retrieval.

## Concrete Plan Changes Requested

- `backend/backend/rag_narrative.py`: implement canonical cache keys with SHA-256, prompt/schema versioning, float rounding, and Pydantic validation of response JSON.
- `backend/backend/api.py`: make `/narrative` validate/rebuild context server-side; do not accept arbitrary full context as authoritative.
- `quality-scorer/src/lib/api.js`: include no-key/quota/timeout states and avoid retry loops that can multiply OpenAI spend.
- `docs/decisions/0005-rag-narrative-and-visual-match.md`: explicitly state "LLM sees only structured metadata, not audio, and does not make legal/copyright judgments."

Verdict: approve the direction after fixing questions 2, 4, 7, and 8. Commit A should tighten endpoint trust, cache stability, and failure behavior before Claude builds the tabs.
