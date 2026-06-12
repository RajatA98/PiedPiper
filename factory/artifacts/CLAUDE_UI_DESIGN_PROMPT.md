---
name: CLAUDE_UI_DESIGN_PROMPT
description: Copy-paste-ready prompt for claude.ai (Artifacts) to design the PiedPiper UI. Grounded in the real Silicon Valley Pied Piper visual identity.
status: Ready
last_updated: 2026-06-10
---

# Copy from here ↓ — paste into claude.ai with Artifacts on

You are designing the UI for a real, deployable web app called **PiedPiper**. It's a portfolio project that will be reviewed by the Head of Engineering at Suno (the AI-music company). The audience is technical, time-pressured, and pop-culture-literate. The visual identity deliberately echoes the fictional company *Pied Piper* from HBO's *Silicon Valley* — and the joke must land on its own, without ever being explained.

Produce a **single self-contained HTML file with all three screens** (landing, ReportCard in two states, evaluation page). Inline CSS. Google Fonts allowed. Use realistic placeholder data (e.g. "Blinding Lights" by The Weeknd). After I approve the mockup, you'll convert it to React + Tailwind v4 components.

---

## What PiedPiper actually does

A user drops an AI-generated music track (from Suno, Udio, etc.) onto the page. The app embeds the audio via an open-source audio model (CLAP), compares it against a hand-curated reference catalog of real songs (~100 recognizable tracks from iTunes previews + ~200 Creative Commons tracks), and returns:

- **Top 3 closest real songs**, ranked highest similarity % first.
- Or, when nothing crosses the similarity threshold: **"Completely unique — this track doesn't sound like anything in our reference catalog."** (That exact string is locked.)
- Two independent secondary signals from ACRCloud, each on its own row:
  - **Cover Song ID** — "Cover match: 'Blinding Lights' by The Weeknd, 88% confidence" or "No cover match"
  - **AI Music Detector** — "AI-generated (87%) — likely Suno" or "Human — likely original"
- An inline **track-quality status badge** ("Track quality: ok" / "issues detected — click to expand"), with a collapsed 7-signal breakdown underneath when expanded.

A separate `/evaluation` page reports measured detector quality: `Recall@1`, `Recall@3`, `MRR`, a score-distribution histogram on negatives, and 5 named false-positive + 5 named false-negative examples with audio playback.

---

## The Silicon Valley reference — grounded facts, use them

In the *Silicon Valley* pilot ("Minimum Viable Product"), Richard Hendricks first pitches Pied Piper as a **music app**: a way for songwriters and composers to search whether their melody already exists in copyrighted form. The pitch is dismissed and the show pivots Pied Piper to a compression algorithm. **PiedPiper-the-project is Richard's original pitch, ten years later, applied to AI-generated music.** The Suno engineering audience will get this instantly.

**Pied Piper's mature visual identity (the Season 5+ "Pied Piper 4.0" rebrand)** — what to echo:

- **A simplified feather glyph** as the brand mark. Schematic, geometric, two-tone. Not a literal piper figure.
- **Wordmark in Prime by Fontfabric** (free for commercial use). Set lowercase: `pied piper` — the lowercase reads "cool, conversational, hip" per the show's design satire. Use it as the nav wordmark.
- **Light, clean aesthetic** — sparse, typographic, deliberately understated. The Pied Piper 4.0 brief in-universe was explicitly "strip away artifice."
- **Single accent color: green** — historically the Pied Piper accent. Use a precise warm-modern green like `#1FB47A` or `#0FAA60`, not a generic lime. White or off-white field; dark navy or near-black text. No gradients.
- **One accent color used sparingly** — for the headline similarity percentage, active states, and the brand mark only. Everything else is the dark-text-on-light-field pair.

If a detail isn't in this list, default to the cleanest possible interpretation. Restraint sells the joke; overuse turns it into Erlich Bachman fan fiction.

---

## Copy direction — the joke is in the copy, not the icons

- **Nav wordmark:** `pied piper` (lowercase, Prime font, with the feather glyph at left).
- **Above-the-fold tagline (h1):** *"Find out if your AI-generated track resembles anything that's come before."* — a direct paraphrase of Richard's original pitch.
- **Subhead (one sentence under h1):** *"Drop in a Suno or Udio output. We embed the audio, compare it against a hand-curated catalog of real songs, and tell you which three you're closest to."*
- **Drop-zone copy:** primary `Drop an audio file` · monospace hint `or click to browse · mp3 wav flac m4a`.
- **Empty-state headline (Case B):** **`Completely unique — this track doesn't sound like anything in our reference catalog`** (exact string, locked).
- **About / methodology subhead:** *"An honest audio-embedding pipeline with a published eval."*
- **Footer Easter-egg line (small, muted, italic):** *"Originally pitched to a confused VC in 2014. Probably more useful now."*

No other Silicon Valley callbacks. No middle-out compression references. No Erlich quotes. One light reference at the top, one subtle one in the footer. Done.

---

## What to design — three screens

### 1. Landing page

Top to bottom:

1. **Nav bar:** feather glyph + `pied piper` wordmark (left); links right: `Examples`, `Evaluation`, `About`.
2. **Hero block:** small monospace kicker `Acoustic-similarity scanner for AI-generated music` → h1 tagline → subhead.
3. **Two-column upload interface:**
   - Left (wider, ~58%): big drop zone with a thin dashed border. Primary text + monospace hint.
   - Right (~42%): card titled "Or try an example" with 3 chips. Each chip shows: a tiny status bar (green for "has match", muted for "unique"), a monospace 6–8 char label like `SUNO·POP`, and the track title in lighter text.
4. **Result area** below the upload row — empty on first load; renders the ReportCard after upload. Render the Case-A ReportCard inline as a preview in the mock.
5. **Footer:** small muted line with the Easter-egg quote, repo link, evaluation page link.

### 2. ReportCard — design BOTH states

**Case A (top match ≥ threshold) — render this realistic:**

- Top kicker: `TOP MATCH` (monospace, uppercase, letter-spaced).
- Headline split: huge `87%` (display-scale, in the green accent) + `similar to` (small grey) → on the next line: `Blinding Lights — The Weeknd` (display-scale).
- Tiny `[↗ open in iTunes]` link on the right.
- Below: kicker `TOP 3 CLOSEST IN CATALOG`. Three rows, each with: rank, title — artist, a horizontal similarity bar (thin, green), percentage right-aligned.
- Thin divider line. Below it, two ACRCloud signal rows (one line each) with monospace labels on the left and the result on the right:
  - `ACRCLOUD · COVER SONG ID` — `Cover match: "Blinding Lights" by The Weeknd, 88%`
  - `ACRCLOUD · AI MUSIC DETECTOR` — `AI-generated (87%) — likely Suno`
- Inline quality badge at the bottom: tiny green dot + `Track quality: ok` + `(see breakdown)` link.

**Case B (no match crosses threshold) — render this realistic too:**

- Top kicker: `RESULT`.
- Headline: `Completely unique` (display-scale, in the dark text color — not green).
- Subhead: `No close matches in our reference catalog` (small grey).
- Below: kicker `CLOSEST TRACKS · FOR REFERENCE, NOT MATCHES`. Same three-row layout as Case A, but the entire block is muted (~60% opacity) so it doesn't compete with the unique headline. Bars and percentages are still shown, in a desaturated color (no green).
- Same ACRCloud rows + quality badge layout as Case A.

### 3. `/evaluation` page

- Page header: `Evaluation` (display) + monospace subkicker `measured, not claimed`.
- Three big metric cards in a row: `Recall@1: 0.83`, `Recall@3: 0.91`, `MRR: 0.79`. Each card has a tiny one-line caption explaining what it measures, plus the n= count.
- A bar-chart histogram of top-1 cosine scores on the negatives set. Y-axis is count; X-axis is similarity 0.0 → 1.0. A vertical line at the `0.70` threshold, labeled `Completely unique cutoff`. Caption explains: this shows where the noise floor sits.
- A grid: two columns, 5 false-positive cards left + 5 false-negative cards right. Each card has: small audio-player placeholders for both the query and retrieved track, a one-sentence "why this happened" italic note, and the actual cosine similarity number.
- A short methodology paragraph: 30 seed songs × 2 Suno generations each + 20–30 unrelated negatives = ~80 tracks.
- A short limitations paragraph: catalog size, single-generator (Suno only), no inter-rater agreement, US-pop bias.

---

## Anti-AI-slop rules — non-negotiable

- ❌ No gradients of any kind. Flat fills only.
- ❌ No drop shadows on cards. Use thin (1px) borders and spacing.
- ❌ No `border-radius` greater than `4px`. Pied Piper has geometric edges. Most things should be sharp-cornered.
- ❌ No emoji in the UI. No "✨", "🎵", "🚀", anything.
- ❌ No center-aligned body text. Body is left-aligned. Center alignment only for the hero headline and the Case-B unique headline.
- ❌ No "powered by AI" badges, no glassmorphism, no neumorphism.
- ❌ Maximum two type families: display + monospace. (Plus optional UI sans if needed; cap at three.)
- ❌ Maximum one accent color used at a time. Green only for the active state, the headline percentage in Case A, and the brand mark.
- ❌ No font-size escalation in body — use a real type scale (12 / 14 / 16 / 18 / 24 / 32 / 48 / 64 px).

## Do this instead

- ✅ Strong typographic hierarchy. Numbers (`87%`, `Recall@3: 0.91`) are display-scale.
- ✅ Honest spatial rhythm (8 / 16 / 24 / 40 / 64 px). Don't squish things.
- ✅ Thin 1px divider lines in a soft warm grey carry the structure. No card-on-card stacks.
- ✅ Monospace kickers (uppercase, letter-spaced) read as engineering taste — use them above each section.
- ✅ One tasteful Pied Piper reference (feather glyph), not three.

---

## Concrete palette and type to use

Start from these tokens. Adjust the green if your eye finds a better shade, but stay in the warm-modern-green family — no lime, no mint, no teal.

| Token | Value | Use |
|---|---|---|
| `bg` | `#FAFAF7` (warm off-white) | Page background |
| `ink` | `#0E1620` (near-black with a hint of navy) | Body text, headlines |
| `dim` | `#5B6471` (cool mid-grey) | Subhead, captions |
| `faint` | `#8C95A1` (light grey) | Monospace kickers, hints |
| `line` | `#E2E1DA` (warm divider grey) | Borders, dividers |
| `accent` | `#0FAA60` (warm Pied Piper green) | Headline %, active states, feather glyph |
| `accent-soft` | `rgba(15, 170, 96, 0.10)` | Active row tint, drop-zone hover |

| Family | Use |
|---|---|
| **Prime** (Fontfabric, lowercase) | `pied piper` wordmark in the nav, and nowhere else |
| **Inter** or **Söhne** | Display + UI body |
| **JetBrains Mono** | Kickers, metric labels, monospace hints |

Use Google Fonts for Inter (and Prime if available there; fall back to Inter for the wordmark with `font-stretch: condensed` if Prime isn't loadable).

---

## Deliverables

**Right now:** the single self-contained HTML file with all three screens. Use real placeholder data (real song titles + artists). Build the ReportCard in both Case A and Case B states side by side or as a tabbed preview so I can see them both.

**After I approve the mockup:** React + Tailwind v4 component files ready to drop into a `quality-scorer/src/components/` directory:
- `Nav.jsx`, `Hero.jsx`, `DropZone.jsx`, `ExampleChips.jsx`
- `ReportCard.jsx` (must support both cases via a `caseB={true}` prop)
- `SimilarityRow.jsx`, `AcrCloudRow.jsx`, `QualityBadge.jsx`
- `EvaluationPage.jsx` + sub-components: `MetricCard.jsx`, `ScoreHistogram.jsx`, `NamedExampleCard.jsx`
- A Tailwind theme block defining the palette + type tokens above

Functional components only. No TypeScript. Inline JSDoc for prop shapes.

---

## Suno flare — secondary brand-aware moments (added 2026-06-10)

PiedPiper's green is the primary identity. **Suno's warm-rose accent appears only when the system identifies a Suno-generated output** — a small, on-thesis nod that the detector knows its audience. Grounded in: Suno's Feels-Like-rebrand palette (warm rose + cream), their **Roobert** typeface from Displaay (Moog-inspired geometric mono-linear sans), and the "rigorous-minimal-with-playful-expression" philosophy.

Add to the palette:

| Token | Value | Use |
|---|---|---|
| `--suno` | `#F25C54` | Warm rose — Suno-flare base |
| `--suno-soft` | `rgba(242, 92, 84, 0.10)` | Pill background |
| `--suno-deep` | `#B8403A` | Pill text / sigil stroke |

Apply in exactly two places, nowhere else:

1. **The AI Music Detector row** — when the value contains `likely Suno`, wrap "likely suno" (lowercase, in Roobert's mono-linear spirit) in a tiny `.suno-pill` element with `--suno-soft` background, `--suno-deep` text, 1 px `rgba(242,92,84,0.22)` border, sharp-cornered (`border-radius: 2px`), and a small SVG sigil — a stylized "S" curve echoing Suno's wonk mark. Other generators (Udio, Sonauto, etc.) get the same pill shape in muted ink tones, no rose.
2. **A tiny `detector-row` in the footer** — a "detects" label followed by a row of 16×16 letter-glyphs (`S`, `U`, `·`) where the Suno glyph is the only one tinted rose. Reads as a brag bar without taking real estate.

Both treatments are visible in the locked reference mockup `factory/artifacts/ui_mockup_v2_suno_flare.html`. Apply identical structure when converting to React/Tailwind components — produce `SunoPill.jsx` as a separate small component used by `AcrCloudRow.jsx`.

Do not use Suno rose anywhere else. Do not change the body typography or display headlines to Roobert; Roobert is paid (Displaay) and a typeface swap would dilute PiedPiper's identity. Inter + JetBrains Mono + Outfit (for the wordmark) stay locked.

## Quality bar

A Suno engineer who knows the *Silicon Valley* show should click the URL, see the wordmark + tagline, smile once, and then spend ten minutes actually reading the evaluation page. The "likely suno" rose pill should land as a quiet wink — *they see it after the joke has already done its work*. If all three signals fire — the show joke lands AND the eval page is substantive AND the Suno brand nod feels self-aware rather than try-hard — the demo has done its job.

Start with the HTML mockup. Show me when you're done.

# Copy to here ↑
