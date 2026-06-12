---
name: CODEX_PHASE_5
description: Phase 5 implementation handoff for Codex — ACRCloud Cover Song ID + AI Music Detector integration. Self-contained.
status: Ready
last_updated: 2026-06-11
---

# Phase 5 implementation — ACRCloud integration (Cover Song ID + AI Music Detector)

**For Codex. Read this file end-to-end, then implement.**

---

## Quick orientation

Phase 5 lights up the two **independent ACRCloud commercial signals** on the ReportCard:

1. **Cover Song ID** — "does this resemble a known composition?" Paired against the self-built CLAP retrieval.
2. **AI Music Detector** — "is this AI-generated, and likely from Suno/Udio/etc?" Directly on-thesis for the audience.

Both signals appear as independent rows on the ReportCard. They answer different questions and **must never be collapsed into one verdict**. This is locked in LOCKED_DECISIONS Q10.

The feature is **trial-gated**: during the 14-day ACRCloud free trial the backend makes live calls with valid credentials. After expiration, the flag flips off and the backend returns `status="disabled"` for both signals; the frontend's existing `AcrCloudRow.jsx` already renders that state gracefully ("Signal unavailable in public demo — cached results visible on examples").

---

## Read first

1. **`factory/artifacts/LOCKED_DECISIONS.md`** — sections "ACRCloud — Cover Song ID (P1 #9a)", "ACRCloud — AI Music Detector (P1 #9b)", and Q10's normalized JSON adapter.
2. **`factory/artifacts/PROJECT_PLAN.md`** — Phase 5 section + the cost-discipline notes.
3. **`backend/backend/acrcloud_engine.py`** — Phase 5 scaffold with 6 TODOs you implement.
4. **`backend/tests/test_acrcloud_engine.py`** — the contract; make these pass.
5. **`quality-scorer/src/components/AcrCloudRow.jsx`** — already consumes the locked wire shape; you don't modify the frontend.

ACRCloud's own docs you'll need:
- Identification API: https://docs.acrcloud.com/reference/identification-api
- AI Music Detection API + payload schema: https://docs.acrcloud.com/reference/console-api/file-scanning/metadata/ai-music-detection
- AI Music Detection FAQ (notes on bundling + interpretation): https://docs.acrcloud.com/faq/ai-music-detection

---

## Package layout reminder

The installed package is `backend`. Use `from backend import acrcloud_engine, config, similarity`. Scripts live at `backend/backend/scripts/`. No `backend.backend.*` imports.

---

## Files to implement / modify

### NEW — implement the TODOs

| File | Role | TODOs |
|---|---|---|
| `backend/backend/acrcloud_engine.py` | The whole ACRCloud surface — auth, both signal calls, normalization, response dataclasses. | `is_enabled`, `call_for_query`, `call_cover_song_id`, `call_ai_music_detector`, `to_response_dict`. (`disabled_response` and `load_cached_for_example` are already complete in the scaffold.) |

### MODIFY — `backend/backend/api.py`

Surgical edits — keep all existing Phase 2 logic intact:

1. **Add import** at the top:
   ```python
   from . import acrcloud_engine
   ```

2. **Truncate query audio for ACRCloud** in `_decode_and_pipeline()` (around line 129). ACRCloud's Identification API works best with ≤15 s / ≤1 MB of audio. After the existing librosa decode + the 90 s CLIP_CAP_S truncation for CLAP, also produce a separate **15-second mono PCM WAV buffer** for ACRCloud:
   ```python
   import io
   import soundfile as sf  # already a runtime dep

   # Existing CLAP truncation runs first (uses CLIP_CAP_S = 90).
   # Then for ACRCloud, take the first 15 s of the mono signal at
   # ANALYSIS_SR (22.05 kHz, mono int16), and write it to an in-memory
   # WAV buffer. WAV via soundfile is guaranteed; MP3 encoding is NOT
   # guaranteed in our deps and pulling in an encoder is out of scope.
   acrcloud_n = int(15 * sr)
   acrcloud_slice = mono[:acrcloud_n]
   buf = io.BytesIO()
   sf.write(buf, acrcloud_slice, sr, format="WAV", subtype="PCM_16")
   pipeline["acrcloud_audio"] = buf.getvalue()
   # ~660 KB at 22.05 kHz × 15 s × 2 bytes — comfortably under ACRCloud's 1 MB rec.
   ```

3. **Call ACRCloud in `/neighbors`** (around line 240, after the `neighbors = similarity.top_k_neighbors(...)` line):
   ```python
   # ACRCloud (P1) — gated by env flag, never blocks the response on failure.
   acr = acrcloud_engine.call_for_query(pipeline["acrcloud_audio"])
   acr_dict = acrcloud_engine.to_response_dict(acr)
   ```
   Then add the field to the response dict that's already being built:
   ```python
   return {
       "query": query_track,
       "neighbors": neighbors_with_metadata,
       "topMeanPooledSimilarity": ...,
       "topMaxSegmentSimilarity": ...,
       "modelSha": _model_sha,
       "thresholdDefault": _threshold_default,
       "acrcloud": acr_dict,   # NEW — top-level key
   }
   ```

4. **Mirror the addition in the `no_corpus` path** so the response shape stays uniform. Just inline `acrcloud_engine.disabled_response()` via `to_response_dict()` for the no_corpus branch — there's no query audio to call with anyway.

5. **Extend `/health`** to report ACRCloud enablement (no creds, just the boolean):
   ```python
   {
     "ok": True,
     "model": clap_engine.model_id(),
     "modelSha": _model_sha,
     "version": __version__,
     "corpus": len(_corpus_tracks),
     "segments": int(_flat_catalog.segs_flat.shape[0]) if _flat_catalog else 0,
     "acrcloudEnabled": acrcloud_engine.is_enabled(),  # NEW
   }
   ```

### MODIFY — `backend/backend/scripts/_corpus_writer.py` (optional, very small)

The locked `examples.json` row shape extends with an optional `acrcloud` field. When/if you produce example chips with cached ACRCloud responses (Phase 5.5), each row in `examples.json` should look like:
```json
{
  "id": "ex_suno_pop_001",
  "chipLabel": "Suno · Pop",
  "neighbors": [...],
  "verdictHeadline": "...",
  "acrcloud": { ...same shape as /neighbors.acrcloud... }
}
```

For Phase 5, do NOT generate any cached entries — the script that does that is queued as Phase 5.5. Just ensure `_corpus_writer.write_examples` doesn't reject an `acrcloud` field if it's present in an input example spec.

### Tests — make these pass

`backend/tests/test_acrcloud_engine.py` (already exists) tests:

- `is_enabled` gate combinations (flag, creds).
- `disabled_response` shape.
- `to_response_dict` produces the locked camelCase wire shape.
- `call_for_query` short-circuits when disabled — no network.
- Cover Song ID matching, no-match, timeout paths.
- AI Music Detector match (likely Suno + human).
- Partial-failure isolation — one signal failing doesn't cascade.

All HTTP is mocked via `httpx.MockTransport`. The tests don't need real ACRCloud credentials.

---

## Setup

```bash
source backend/.venv/bin/activate

# Required env vars for live calls (leave unset to ship in disabled mode):
export ENABLE_ACRCLOUD=true
export ACRCLOUD_ACCESS_KEY=...
export ACRCLOUD_ACCESS_SECRET=...
export ACRCLOUD_HOST=identify-us-west-2.acrcloud.com   # or your project's region
export ACRCLOUD_AI_DETECTOR_URL=...                    # confirm the path from ACRCloud docs
export ACRCLOUD_AI_DETECTOR_BEARER=...
```

## How to verify you're done

```bash
# 1. Fast unit tests (no network — uses httpx.MockTransport):
cd backend
pytest -q tests/test_acrcloud_engine.py

# 2. Phase 2 + Phase 1 tests still pass:
pytest -q tests/test_corpus_ingest.py tests/test_neighbors_endpoint.py

# 3. With the flag OFF, /health reports acrcloudEnabled=false and /neighbors
#    inlines `status: "disabled"` for both signals (no network touched):
unset ENABLE_ACRCLOUD
.venv/bin/uvicorn backend.api:app &
curl -s http://localhost:8000/health | python -m json.tool
# Expected: acrcloudEnabled=false.
# Upload any audio:
curl -s -F "file=@tests/fixtures/tiny.mp3" http://localhost:8000/neighbors | python -m json.tool
# Expected: "acrcloud" → both signals status="disabled".
kill %1

# 4. With creds set (during your trial window), the two signals return real
#    payloads. The fast tests already exercise the normalization end-to-end.
```

---

## Constraints — non-negotiable

1. **Credentials server-side only.** Never return ACRCloud creds or bearer tokens in any response. The tests assert this with a `repr()` check; don't add fields that leak.
2. **The two signals are independent.** Never compose them into a single verdict. The frontend renders two separate rows.
3. **The camelCase wire shape is locked.** `coverSongId`, `aiMusicDetector`, `scoreSemantics`, `externalIds`, `ai_probability`, `likely_source`. These exact keys. The tests assert them.
4. **No cascading failures.** If Cover Song ID times out, AI Music Detector still runs and returns its payload. Same the other way around. `call_for_query` catches per-signal exceptions and maps them to the `timeout`/`quota_exceeded` statuses.
5. **15-second / 1 MB audio cap for ACRCloud calls.** Truncate before sending. Don't try to call ACRCloud with the full 90 s CLAP window — the API is documented to work best on short clips.
6. **Feature flag default is OFF.** Both `ENABLE_ACRCLOUD=false` and missing creds should produce `disabled` payloads with zero network.
7. **No emojis** in code, comments, or response messages.
8. **Don't touch** anything else: Phase 1 ingest scripts, similarity module, frontend components, factory/artifacts.

---

## Edge cases to handle

- **AI Music Detector likely_source variants** — ACRCloud documents `suno`, `udio`, `sonauto`, `mureka`, `riffusion`. The frontend SunoPill only renders the rose-tinted pill for `likely_source === "suno"`; other engines render in plain ink. Don't lowercase/normalize the source string on the backend — pass through verbatim.
- **ACRCloud rate-limited** (429) — treat as `status="quota_exceeded"`. Don't retry; the trial has hard limits.
- **AI Music Detector returns `no_vocals`** — that's a valid verdict, not an error. The payload's `verdict` field carries it; `status="match"` (because the call succeeded).
- **Signing timestamp** — Identification API expects an integer Unix timestamp (UTC), not ISO 8601. Use `int(time.time())`.
- **Empty `metadata.music` array** in a Cover Song ID 200 response — same as `status.code != 0`: maps to `status="no_match"`.

---

## When you're done

Return a short note (under 250 words):

1. Confirmation `pytest -q tests/test_acrcloud_engine.py` passes (paste output).
2. Confirmation Phase 2 tests still pass.
3. Output of `/health` showing `acrcloudEnabled` correctly reflects your env setup.
4. Output of `/neighbors` from a small audio upload showing the `acrcloud` key with both signal statuses. Either: both `"disabled"` (flag off), or both with live ACRCloud responses (flag on with creds — only do this during the trial).
5. Anything you flagged or judgment-called on (e.g. which ACRCloud endpoint URL the AI Music Detector ended up hitting).

Phase 6 (eval pipeline + named FP/FN examples) is the next scaffold once Phase 5 lands.
