# Codex prompt — Tighten the synthesized PRESEARCH.md

> Copy everything below the line into Codex. Codex should also be given access to (or paste in) the three files referenced.

---

You previously produced a Presearch document for **PiedPiper** — a pre-publish acoustic-similarity scanner for AI-generated music targeted as a portfolio artifact for Suno's Head of Engineering. Claude has now synthesized your output with its own independent research pass into a single `PRESEARCH.md`.

## Your job in this turn

You are doing a **tightening pass**, not a redo. Review the synthesized document, push back where Claude got it wrong, verify where flagged, and cut padding. Do not rewrite sections that are already tight.

## Files

You have three files in front of you:

1. **`CLAUDE_PRESEARCH.md`** — Claude's original research pass.
2. **`CODEX_PRESEARCH.md`** — your original research pass.
3. **`PRESEARCH.md`** — Claude's synthesis of the two. This is what you're tightening.

## What to do

Read `PRESEARCH.md` end to end. Then address each of the items under **"Open items for Codex's tightening pass"** at the bottom of that document:

1. **Verify iTunes Search API `previewUrl` is still accessible without auth in 2026.** Use web search. If it's been deprecated or paywalled since Apr 2026, the catalog-source recommendation (decision #2) needs to fall back to your original answer (FMA/MTG-Jamendo + ACRCloud as recognition). Update the relevant sections directly.

2. **Re-examine the pivot from ACRCloud Cover Song ID to AI Music Detector** (decision #3). Claude overruled you on audience-fit grounds. Either confirm the pivot is correct (with a sentence on why you missed it the first time) or push back with sources showing Cover Song ID is the better engineering signal — or a hidden gotcha in AI Music Detector pricing/availability.

3. **Quantitative CLAP thresholds.** If you find published threshold data (not blog interpretation) for music-similarity in CLAP-512 space, surface it and update Q1.

4. **Q4 metric stack** — confirm Recall@k + MRR + MR1 + MAP is the right combination at N=30–100 queries, or recommend trimming. Some of those metrics are linearly dependent at small N.

5. **ACRCloud cost discipline.** Verify the AI Music Detector "free when bundled with Derivative Works Detection" claim. Confirm whether Derivative Works Detection itself has a free tier. If the bundle is paid-only, the cost story changes and Q10 needs an update.

6. **Track length normalization.** Recommend a specific normalization (center 30 s? max 90 s? sliding window with mean pooling?) based on CLAP audio-input best practices and what makes embeddings comparable between a 30 s preview and a 2–4 min Suno track. Add to Things-to-flag #4.

7. **Anywhere Claude padded.** The synthesis is meant to be tight and actionable. Cut anything that doesn't change a build decision.

## What to produce

Two things:

### 1. A revised `PRESEARCH.md`

Edit in place. Use the same overall structure (headline disagreements, per-question recommendations, things to flag, open items). Preserve content that's good; rewrite content that's wrong or padded.

At the top of the file, replace `status: In Progress (awaiting Codex tightening pass)` with `status: In Progress (awaiting Claude finalization)`.

### 2. A short changelog at the bottom

Append a section titled `## Codex tightening pass — 2026-06-05` that lists, in 5–15 bullets:

- What you verified and what you found
- What you changed and why
- What you pushed back on and why
- Anything you couldn't resolve (with a one-line note on what would resolve it)

## Constraints

- **Do not pad.** If a recommendation is already one sentence, leave it one sentence.
- **Cite real URLs.** No invented references.
- **If you disagree with a Claude decision but can't disprove it with sources, say so explicitly** rather than rewriting silently.
- **Preserve the file links and citations** that are still valid.
- **Stay opinionated.** Claude will finalize after this — your job is to land sharp recommendations, not to be diplomatic.
