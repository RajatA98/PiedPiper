---
name: CODEX_PHASE_3
description: Phase 3 implementation handoff for Codex — frontend rewire to the similarity-first product shape. Self-contained.
status: Ready
last_updated: 2026-06-11
---

# Phase 3 implementation — Frontend rewire (similarity-first UI)

**For Codex. Read this file end-to-end, then implement.**

---

## Quick orientation

Phase 1 + 1.5 + 2 + 4 will be landed (or in flight) when you start. The backend now has:

- A 160-track reference catalog (10 Tier-1 iTunes + 150 Tier-2 MTG-Jamendo) at `quality-scorer/public/corpus/`.
- A `POST /neighbors` endpoint returning top-3 with `meanPooledSimilarity` + `maxSegmentSimilarity` per neighbor, plus `modelSha` + `thresholdDefault` at the top level.
- A `POST /analyze` endpoint untouched (still serves the inherited quality badge).
- A live FastAPI app titled "PiedPiper".

Phase 3 flips the visible product from the inherited "Soundcheck quality scorer" to the locked similarity-first PiedPiper experience:

- **Headline** = top 3 closest real songs, ranked by similarity %, with a "Completely unique" empty state.
- **Two ACRCloud rows** as independent secondary signals (Cover Song ID + AI Music Detector).
- **Quality badge demoted** to an inline status indicator with expandable 7-signal breakdown.
- **Pied Piper visual identity** — cream + navy + warm green accent, lowercase wordmark, restrained Silicon Valley reference in copy.
- **Suno-flare pill** on the AI Music Detector row when `likely_source === "suno"`.

The locked design is in `factory/artifacts/ui_mockup_v2_suno_flare.html` — open it in a browser before writing JSX. It is the contract.

---

## Read first

1. **`factory/artifacts/LOCKED_DECISIONS.md`** — sections "Product shape", "Empty-match copy", "ACRCloud — Cover Song ID (P1 #9a)" and "AI Music Detector (P1 #9b)", "Quality status badge", "Suno flare".
2. **`factory/artifacts/ui_mockup_v2_suno_flare.html`** — the locked design. Open it. Toggle the Case A / Case B segmented control. Look at the eval page. This is what you build.
3. **`factory/artifacts/CLAUDE_UI_DESIGN_PROMPT.md`** — the "Suno flare" section in particular; the anti-AI-slop rules; the locked palette and type stack.
4. **`backend/backend/api.py`** + **`backend/backend/similarity.py`** — for the live `/neighbors` response shape.

---

## What's already scaffolded (don't recreate)

Claude scaffolded these for Phase 3 — open and read them; build on them:

- **`quality-scorer/src/lib/api.js`** — `neighborsUpload(file, k)` + `deriveHeadline(response)` pure helper. Existing `analyzeUpload(file)` retained for the quality badge.
- **`quality-scorer/src/lib/api.test.js`** — Vitest unit tests for `deriveHeadline`. Add Vitest to `devDependencies` and wire `npm test` (see below).
- **`quality-scorer/src/components/SunoPill.jsx`** — small "likely suno" pill atom. Visual is locked; SVG sigil is inline.
- **`quality-scorer/src/components/SimilarityRow.jsx`** — one rank+title+bar+pct row.
- **`quality-scorer/src/components/AcrCloudRow.jsx`** — Cover Song ID or AI Music Detector row, with a `renderValue` helper covering the 5 status cases. Two TODOs near the bottom.
- **`quality-scorer/src/components/QualityBadge.jsx`** — inline badge + expandable breakdown. Two TODOs: derive `hasIssues` from `/analyze`, render `signals` array into breakdown rows.
- **`quality-scorer/src/components/SimilarityReport.jsx`** — Case A and Case B composer. Largely complete; the linked-out attribution might need one more polish per Tier-1 iTunes rights rules.

---

## Files you implement / modify in this PR

### NEW components — build from the locked mockup

| File | Source for the JSX | Notes |
|---|---|---|
| `src/components/Nav.jsx` | mockup `nav.topbar` block | Wordmark + feather glyph + nav links. Reuse the inline SVG from the mockup. |
| `src/components/Hero.jsx` | mockup `header.hero` block | Monospace kicker + h1 + subhead. Headline is the LOCKED tagline from the design prompt. |
| `src/components/DropZone.jsx` | mockup `.dropzone` block | Drag-drop + click-to-browse. Triggers `onFile(file)` from parent. |
| `src/components/ExampleChips.jsx` | mockup `.example-card` + `.chip` blocks | 3 staged examples; reads from `/corpus/examples.json` if it exists; falls back to a hardcoded shape with a `(no examples yet)` note. |
| `src/components/ReportCard.jsx` | mockup `article.report` block | Composes `SimilarityReport` + two `AcrCloudRow`s + `QualityBadge`. |
| `src/components/Footer.jsx` | mockup `footer` + `.detector-row` blocks | Easter-egg italic line + detector sigil row (`S` rose-tinted) + repo / eval links. |
| `src/components/Layout.jsx` | mockup overall scaffold | Wraps Nav + content + Footer. |

### REWRITE pages

| File | What changes |
|---|---|
| `src/pages/ScorerPage.jsx` | Full rewrite. Hero + DropZone + ExampleChips + ReportCard. State: `status` ('idle' / 'analyzing' / 'result' / 'error'), `neighbors` (the /neighbors response), `analyze` (the /analyze response, kicked off in parallel for the QualityBadge). |
| `src/pages/EvaluationPage.jsx` | Full rewrite when `quality-scorer/public/corpus/eval.json` exists. Show 3 metric cards + histogram + named FP/FN examples + methodology + limitations. **Phase 6** owns the eval data; for Phase 3 just render an `eval.json not yet present` empty state matching the mockup's metric-card layout. |

### ADD Tailwind / theme tokens — `src/index.css`

The current `@theme` block is the inherited dark-phosphor Soundcheck palette. **Replace it** with the locked Pied Piper tokens + Suno flare. Also remove the `body::before` (oscilloscope grid) and `body::after` (noise overlay) — they're part of the old aesthetic. Drop the `:focus-visible` outline color to use the new accent.

Concretely, swap the values to:

```css
@theme {
  /* Pied Piper light palette — locked in CLAUDE_UI_DESIGN_PROMPT.md */
  --color-bg: #FAFAF7;          /* warm off-white field */
  --color-panel: #FFFFFF;       /* surface where cards sit */
  --color-elev: #FFFFFF;
  --color-line: #E2E1DA;        /* warm divider grey */
  --color-line-soft: #EFEEE8;

  --color-ink: #0E1620;         /* near-black, slight navy */
  --color-dim: #5B6471;
  --color-faint: #8C95A1;

  --color-accent: #0FAA60;      /* warm Pied Piper green */
  --color-accent-dim: rgba(15, 170, 96, 0.10);

  --color-pass: #0FAA60;
  --color-warn: #D98A2B;
  --color-fail: #C73936;

  /* Suno flare — reserved for the AI Music Detector likely-Suno case only.
     Used by SunoPill.jsx and the detector sigil row in the footer. */
  --color-suno: #F25C54;
  --color-suno-soft: rgba(242, 92, 84, 0.10);
  --color-suno-deep: #B8403A;

  --font-display: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  --font-wordmark: "Outfit", "Inter", sans-serif;
}
```

Also update the Google Fonts `<link>` in `quality-scorer/index.html` from the current Archivo/Bricolage stack to:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet" />
```

### Vitest setup

`vitest` isn't yet in `package.json`. Add it as a dev dependency along with `@testing-library/react` for any component tests you add, and wire `npm test` to `vitest run`. The pure `api.test.js` already exists and should pass; component tests are optional but encouraged.

```bash
npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

In `package.json` scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

In `vite.config.js` (or a new `vitest.config.js`):

```js
test: { environment: 'jsdom' }
```

---

## How to verify you're done

```bash
# 1. Dev server runs:
cd quality-scorer
npm install
npm run dev
# Open http://localhost:5173 — should look like ui_mockup_v2_suno_flare.html.

# 2. Drop an mp3 onto the drop zone → ReportCard renders Case A or Case B
#    based on the live /neighbors response.

# 3. Tests pass:
npm test
# Expected: deriveHeadline tests all green. Any component tests you add: green.

# 4. Build succeeds with no Soundcheck-era warnings/imports left over:
npm run build
```

End-to-end smoke check (local, both sides):

1. `uvicorn backend.api:app --reload --port 8000` from the repo root (after Phase 2 is merged).
2. `cd quality-scorer && npm run dev`.
3. Open `http://localhost:5173`. Drop a Suno mp3 file. Observe:
   - "analyzing…" state during the round trip
   - ReportCard appears with top-3 sorted desc by similarity %
   - When the top match crosses 0.70 → Case A headline; otherwise Case B
   - Two ACRCloud rows render (will show the cached/stub status from Phase 5 until enabled)
   - Quality badge inline; click expands to 7-signal breakdown

---

## Constraints — non-negotiable

1. **The empty-state string is exact.** Case B headline must read: `"Completely unique — this track doesn't sound like anything in our reference catalog"`. Don't paraphrase. LOCKED_DECISIONS enforces this verbatim.
2. **No multi-band verdict chip.** No `unique` / `related` / `similar` / `near-duplicate` labels anywhere in the UI. The percentage IS the answer.
3. **Suno rose is reserved.** Only the SunoPill (in AI Music Detector when `likely_source === 'suno'`) and the small footer detector sigil. Nowhere else.
4. **ACRCloud signals are independent rows**, never collapsed into a composite verdict. Disagreement is information, not a bug.
5. **Headline ranking is `meanPooledSimilarity` only.** `maxSegmentSimilarity` is shown as a secondary value (small monospace under the bar, or as a tooltip on hover — designer's call inside the locked aesthetic) but never used for sort.
6. **Anti-AI-slop rules from the design prompt apply.** No gradients, no rounded-2xl on every container, no emoji in the UI, no center-aligned body text, max two type families plus the wordmark, max one accent color visible at a time. See `CLAUDE_UI_DESIGN_PROMPT.md` for the full list.
7. **`/analyze` still drives the quality badge.** Don't try to derive quality from `/neighbors` — the two endpoints serve different purposes.
8. **No emojis in code, copy, or commit messages.**

---

## Edge cases to handle

- **Backend cold start** — first `/neighbors` after HF Space sleep takes ~30 s. The mockup uses a "warming up the analyzer…" copy swap; preserve that pattern in `ScorerPage.jsx`. The existing `ScorerPage.jsx` has the elapsed-time hook you can reuse.
- **`/corpus/examples.json` empty** — the file currently exists as `[]` (Phase 6 hasn't produced the examples yet). `ExampleChips.jsx` should render an "examples coming soon" placeholder card rather than three blank chips.
- **`no_corpus` response** — backend returns `{ verdict: "no_corpus", neighbors: [] }` if the catalog isn't loaded. `deriveHeadline` already handles this; ReportCard should show a clear "Reference catalog isn't loaded yet" message — see PRESEARCH Q5 for the copy.
- **Quality badge fallback** — if `/analyze` errors or returns nothing, render the loading state (`Track quality: checking…`). Don't block the similarity UI on `/analyze`.
- **Tier-2 (Jamendo) matches with bare track IDs** — until Phase 1.5 is enriched, some Tier-2 tracks will show as `tier2:jamendo:1234567` rather than a title. Render `{track.title || track.trackId}` and fall through gracefully.

---

## When you're done

Return a short note (under 250 words):

1. Confirmation `npm run build` succeeds and `npm test` is green.
2. Screenshots (or descriptions) of: landing page, Case A ReportCard, Case B ReportCard, hover/active states for the chip & dropzone.
3. List of any anti-AI-slop temptations you resisted, or any spots where the locked mockup diverged from the live data shape (so the next reviewer sees the trade-off).
4. Any open TODOs left in the code (file:line refs).

**Do NOT modify:**

- `backend/` (Phase 2 owns it — your job is to consume the response, not change it).
- `factory/artifacts/*` (these are the contract).
- `quality-scorer/public/corpus/*` (Phase 1 owns it).

Phase 5 (ACRCloud) and Phase 6 (eval pipeline + page content) scaffolds next, after Phase 3 lands.
