---
name: CODEX_PHASE_1_5
description: Phase 1.5 handoff for Codex — Tier-2 source resolution. Pick a working Creative Commons catalog source and populate ≥100 Tier-2 rows. Small, focused unblock.
status: Ready
last_updated: 2026-06-10
---

# Phase 1.5 — Tier-2 source resolution

**For Codex. Read this file end-to-end, then implement.**

---

## Why this exists

Phase 1 shipped clean — 10 Tier-1 iTunes tracks are in the corpus, all tests pass — but **Tier-2 came out empty** because the FMA HuggingFace slug we'd planned (`benjamin-paine/free-music-archive`) is inaccessible from Hub. You correctly left Tier-2 empty rather than guess. Phase 1.5 picks a working Creative Commons source and gets `tier_counts.tier2 >= 100`.

That's the whole task. No new architecture, no new contracts. Pick a working data source, plumb it into the existing scaffold, re-run the ingest, ship.

---

## Read first

1. `factory/artifacts/IMPLEMENTATION_LOG.md` — the Phase 1 result and the Tier-2 gap explained.
2. `factory/artifacts/LOCKED_DECISIONS.md` — **"Catalog"** section. Tier-2 must be ≥200 tracks ideal; 100 is the floor that unblocks Phase 6 eval. CC-licensed; no audio bytes committed; segment embeddings required.
3. `factory/artifacts/PROJECT_PLAN.md` — **Phase 1.5** section.

---

## Package layout reminder

Same as Phase 1: the installed package is **`backend`**, not `backend.backend`. Use `from backend import config, clap_windowed`. Scripts live at `backend/backend/scripts/` and run as `python -m backend.scripts.rebuild_corpus`.

---

## Files to modify

| File | Why touch it |
|---|---|
| `backend/backend/scripts/_jamendo_loader.py` | **Primary file to implement** — the Jamendo TSV + CDN pipeline (details below). Functions `load_jamendo_tracks` + `fetch_track_audio` stay (signatures locked). |
| `backend/backend/scripts/_fma_loader.py` | Leave it stubbed but unused — `rebuild_corpus.py` only invokes the loader for sources named in `catalog.yaml`. No need to modify if you're going Jamendo, which you are. |
| `backend/catalog.yaml` | Swap `tier2.fma` for `tier2.jamendo` per the snippet below. Keep `count: 100` minimum. |

**Do NOT modify:**

- `backend/backend/clap_windowed.py` — shipped and tested.
- `backend/backend/scripts/rebuild_corpus.py` — orchestration is right; loader internals are what need fixing.
- `backend/backend/scripts/_corpus_writer.py` — write logic is locked.
- `backend/backend/scripts/_itunes_client.py` — Tier-1 is done.
- `backend/tests/*` — tests already cover Tier-2 (`test_tier2_rows_have_license_and_source_url`). They will start verifying the new rows automatically once they're present.

---

## Source — go MTG-Jamendo (the prior Codex pass confirmed FMA paths are stuck)

The Phase 1.5 review pass surfaced that the FMA candidates aren't going to land in our environment without significant wrestling. **Don't try FMA. Go straight to MTG-Jamendo.** Reasoning is documented; skip the experimentation.

### MTG-Jamendo via direct CDN — the primary path

Per-track audio is served from Jamendo's own CDN at a public URL:

```text
https://mp3l.jamendo.com/?trackid={track_id}&format=mp31   # 96 kbps
https://mp3l.jamendo.com/?trackid={track_id}&format=mp32   # 192 kbps — prefer this
```

Implementation pattern:

1. **Fetch the autotagging metadata TSV** from the MTG-Jamendo repo. **The naive `raw.githubusercontent.com` URL returns a Git-LFS pointer**, not the TSV — that's a real trap. Use the LFS media URL instead:

   ```text
   https://media.githubusercontent.com/media/MTG/mtg-jamendo-dataset/master/data/autotagging.tsv
   ```

   **Before parsing**: peek at the first ~200 bytes. If you see `version https://git-lfs.github.com/spec/v1` you're still pulling a pointer — switch URL. Real TSV starts with a tab-separated header row.

2. **Probe the actual column format.** Don't trust this README's documented schema (or this prompt's claim of one). Read the header line, log it, adapt the parser to whatever columns are actually present. Typical (but verify) columns:

   ```text
   TRACK_ID  ARTIST_ID  ALBUM_ID  PATH  DURATION  TAGS
   ```

   Where `TAGS` is itself tab-separated like `genre---rock\tinstrument---guitar\tmood/theme---energetic`.

3. **Filter rows by genre** when `genres_balanced` is provided — split tags on `\t`, extract `genre---<name>` entries, keep the row if any genre matches.

4. **Sample 130–150 candidate track IDs**, not just `count`. Some Jamendo CDN URLs 404 or rate-limit; some MP3s decode poorly through librosa. ~25 % slop is realistic. Stop adding once you've landed `count` *successful* embeddings, so the final corpus actually hits the target.

5. **For each candidate**: GET the Jamendo CDN URL (prefer `mp32` for CLAP quality; fall back to `mp31` on 429), decode, encode through `clap_windowed.encode_windowed`, store. Build a `JamendoTrack` per the existing dataclass shape.

Jamendo's full catalog is CC-licensed, so:
- `license_short = "MTG-Jamendo (Creative Commons)"`
- `source_url = f"https://www.jamendo.com/track/{track_id}"`

### Update `catalog.yaml`

Swap the `tier2.fma` block out for `tier2.jamendo`:

```yaml
tier2:
  jamendo:
    count: 100
    genres_balanced:
      - "rock"
      - "pop"
      - "electronic"
      - "hiphop"
      - "folk"
      - "jazz"
      - "classical"
```

Genre names in the autotagging TSV are lowercased and may differ slightly from these — the loader should match case-insensitively and skip unknown names cleanly.

### Options NOT to pursue (documented for transparency)

- ❌ HuggingFace `benjamin-paine/free-music-archive` — known broken, confirmed inaccessible from Hub.
- ❌ HuggingFace `mteb/fma_small`, `lewtun/music_genres_small` — Codex Phase 1.5 review found these were not viable paths to a working 100-track corpus in the time budget. Skip experimentation.
- ❌ FMA direct download from Zenodo (`os.unil.cloud.switch.ch/fma/fma_small.zip`) — 8 GB; not worth the bandwidth + storage for a 100-track demo subset.

If for some reason Jamendo's CDN itself is blocked from your environment, escalate back rather than pivoting silently — this is the third-fallback source and there isn't a clean fourth.

---

## Setup

```bash
cd /Users/rajatarora/Projects/PiedPiper
source backend/.venv/bin/activate   # the venv Codex set up in Phase 1
```

The `[ingest]` extras (`httpx`, `pyyaml`) are already installed. The `[runtime]` extras include `datasets` for HF Hub access.

## How to verify you're done

**Important:** the existing tests verify the *shape* of Tier-2 rows when present — they do NOT enforce `tier2 >= 100`. The acceptance check is the manifest, not pytest. Run all three steps; all must pass.

```bash
# 1. Re-run the ingest from repo root:
python -m backend.scripts.rebuild_corpus

# Expected output line:
#   wrote N tracks (tier1=10, tier2=>=100) -> quality-scorer/public/corpus

# 2. The hard gate — assert tier2 count from the manifest:
python -c "
import json
m = json.load(open('quality-scorer/public/corpus/manifest.json'))
assert m['tier_counts']['tier2'] >= 100, f'FAIL: tier2 = {m[\"tier_counts\"][\"tier2\"]}, need >= 100'
print('PASS: tier_counts =', m['tier_counts'])
"

# 3. Tests still pass and test_tier2_rows_have_license_and_source_url is no longer skipping:
cd backend
pytest -q tests/test_corpus_ingest.py
# Look for: test_tier2_rows_have_license_and_source_url PASSED (not SKIPPED).
```

If step (2) fails because the manifest reports `< 100`, you fetched too few candidates — bump the per-genre target by ~30 % and re-run. The script is idempotent given the same `catalog.yaml`; the second run just adds rows.

---

## Constraints — non-negotiable

1. **No audio bytes committed** to `quality-scorer/public/corpus/` (existing test `test_no_audio_bytes_committed_to_corpus_dir` enforces this — same Apple-style stream-not-cache discipline applies to FMA/Jamendo audio: fetch → encode → discard).
2. **L2-normalized rows** in `embeddings.npy` and every value in `segment_embeddings.npz`. The corpus writer validates this before write — don't bypass.
3. **Don't change function signatures** — `load_fma_tracks(count, genres_balanced=None) -> list[FMATrack]`, `fetch_track_audio(track) -> bytes`. Same for Jamendo. If you change the dataclass shape, `rebuild_corpus.py` breaks — don't.
4. **No new top-level deps.** The pyproject.toml's `[runtime]` + `[ingest]` groups already cover everything you need (`httpx`, `pyyaml`, `datasets`, `numpy`, `librosa`, `soundfile`, `torch`, `transformers`, `tqdm`). If you genuinely need one more, add it to `[ingest]` and call it out.
5. **Reuse `clap_windowed.encode_windowed`** — don't re-implement windowing. Tier-2 audio should run through the exact same encoder as Tier-1 so the corpus embeddings are comparable.
6. **No emojis** in code or output.

---

## Edge cases to handle

- **Tier-2 source unavailable** mid-run (network blip, CDN 5xx) — log and skip the individual track, continue. Same pattern Phase 1 uses for iTunes preview failures.
- **Some tracks fail to decode** (codec mismatch, partial download) — log + skip. The whole job should succeed if ≥80% of attempted Tier-2 tracks landed.
- **`genres_balanced` filter exhausts a genre** before hitting per-genre quota — fill the remainder from other genres rather than over-sampling the exhausted one.
- **Jamendo URL pattern variants** — `format=mp32` (192 kbps) is the default; if a particular track 429s, fall back to `format=mp31` (96 kbps). 192 kbps is safer for CLAP-quality embeddings.
- **TSV header has trailing whitespace / BOM** — some MTG-Jamendo TSV mirrors have a UTF-8 BOM or trailing CR characters on column names. Normalize before matching column names.

---

## When you're done

Return a short note (under 200 words):

1. Which source (Option A / B / C) you landed on, and a one-line "why".
2. The final `tier_counts` from the regenerated manifest.
3. Test results — `pytest -q tests/test_corpus_ingest.py` output, especially `test_tier2_rows_have_license_and_source_url` (it should no longer skip).
4. Any flags or skipped concerns.

Do NOT modify:
- `factory/artifacts/*` (these are the contract)
- `quality-scorer/src/` (Phase 3 territory)
- `quality-scorer/public/corpus/*` outside what `rebuild_corpus.py` writes
- `backend/backend/api.py`, `clap_engine.py`, `clap_windowed.py`, `_itunes_client.py`, `_corpus_writer.py`, `rebuild_corpus.py` orchestration (Phase 1 territory)

When you ship, the corpus has ≥110 total tracks and Phase 6 eval is unblocked. Phase 2 (backend `/neighbors` rewiring) scaffolds next.
