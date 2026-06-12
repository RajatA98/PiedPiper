---
name: PROBLEM_SUMMARY
description: Problem summary for PiedPiper — a pre-publish similarity check for AI-generated music against a real-music reference catalog
status: Complete
last_updated: 2026-06-04
---

> **Superseded by [LOCKED_DECISIONS.md](LOCKED_DECISIONS.md) on 2026-06-09.**
>
> This document captures PiedPiper's original Understand-phase framing. Subsequent decisions — the verdict-chip removal, the three-signal ReportCard, the ACRCloud framing, the iTunes + Jamendo two-tier catalog, and more — live in `LOCKED_DECISIONS.md`. When this file conflicts with `LOCKED_DECISIONS.md`, the locked decisions win. This file is kept for narrative continuity and historical context; do not treat it as the current contract.

# Problem Summary — PiedPiper

**Pre-publish acoustic-similarity scanner for AI-generated music.** Upload a track, see the closest real-song match, similarity %, top-3 neighbors, and a calibrated risk verdict (unique / related / similar / near-duplicate).

> The name is a deliberate *Silicon Valley* reference: in the show, Pied Piper began as a music-compression / similarity tool, and the pilot revolves around using it for copyright-similarity detection on songs. Same problem space.

## What is being built

A deployed web app that takes an AI-generated music track (primary use case: Suno output) and returns **how acoustically similar it is to a real, existing popular song.** The user drops in an audio file and receives a report containing:

1. **Similarity verdict (the headline)** — the closest-matching real song from a reference catalog, shown by name + artist, with a similarity percentage (e.g. "87% similar to 'Blinding Lights' by The Weeknd"), plus the top 3 closest matches with similarity bars and link-outs.
2. **Track-quality status badge (secondary)** — a small inline indicator that runs the inherited broken-output detector (silence, clipping, noise, truncation) and surfaces a one-line status like *"Track quality: ok"* or *"Track quality: issues detected — click to see"*. It is a sanity check, not a co-equal verdict — most users will glance at it and move on.

The report is presented as a single ReportCard, viewable in seconds.

## Why it is being built

In priority order:

1. **Land an interview at Suno.** The user's friend personally knows Suno's Head of Engineering and will send the user's resume + this project together as a warm intro. The project's job is to make the case "this person is worth interviewing." The Head of Eng can then route the user into a generic interview process and place them on whichever team fits best — this artifact does NOT need to argue for a specific role.

2. **Be on-thesis for Suno specifically.** The pending RIAA lawsuits against Suno and Udio are about generated outputs being too close to existing copyrighted recordings — exactly what this tool addresses. The framing creates shared context for the conversation that follows the project review.

3. **Learn during the build** (co-goal). Audio embeddings, vector search, eval discipline, threshold calibration, and hybrid system comparison are all things the user wants to internalize through doing.

4. **Builds on existing engineering** (~90% of the audio-ML and infra transfers from the prior Soundcheck work), letting the build focus on the genuinely-new pieces (catalog sourcing, similarity-first UI, hybrid second opinion, similarity eval).

## The problem it solves

AI music generators publish tracks that may sound suspiciously close to existing copyrighted songs — sometimes through training-data memorization, sometimes through mode collapse onto a popular hook, sometimes by chance. **Today there is no easy, public, single-track tool** that takes an AI-generated audio file and tells you "this sounds like *X* by *Y* with *N%* similarity."

That gap is what PiedPiper fills: one upload, one report, the closest real song surfaced with a similarity score the user can act on. A secondary track-quality status badge runs alongside as a sanity check on broken outputs, but the headline product is similarity.

## Target users

- **Real audience: one person — the Head of Engineering at Suno.** A warm-intro reader (introduced by a mutual friend) who will spend 5–20 minutes substantively reviewing the project alongside the user's resume. Predisposed to give it a fair read; engages with strong defensible opinions; cares about output quality, training-data leakage, and the production reality of running an AI-music platform at scale. Will route the user into a generic interview process and place them on whichever team fits — the project does not need to argue for a specific role.
- **Framing-device audience: platform-side operators** (ML Eval, Trust & Safety, Platform Engineering at AI-music companies). The tool is positioned as "the kind of pre-publish risk pipeline a vendor's T&S team would build internally" — this isn't who actually opens the link, but it's the mental model the README invites the actual reader into.
- **Stand-in: any visitor.** No account, no setup; example tracks resolve instantly; the value is visible to anyone who opens the URL.

## Core capability (single-track check)

- **Input:** an audio file (mp3 primary; wav/flac/ogg/m4a also accepted) via drag-drop or file picker; or a staged example track.
- **Primary analysis:** acoustic similarity between the uploaded track and a precomputed reference catalog of real popular music. (Specific embedding/matching technology is an Open Question — see Presearch.)
- **Similarity output (headline):** top match by name + artist + similarity %, top-3 neighbors with similarity bars and link-outs to the track on its source platform, a plain-English verdict (e.g. unique / related / similar / near-duplicate).
- **Secondary quality check:** inherited broken-output detector (silence, clipping, noise, truncation, etc.) runs in the same decode pass. Surfaces as a single inline status badge with optional expand-to-see-details.
- **Evaluation surface:** in-app page showing measured similarity-detector quality against a hand-labeled golden set (precision/recall, agreement-rate metrics where multiple matchers are used).

## Constraints

- **Reference catalog will be a sampled corpus** of real popular music, explicitly incomplete — the README will state that productionizing means indexing a licensed catalog (the kind a vendor would have internally; the demo can't).
- **No redistribution of source audio.** If catalog tracks come from a streaming provider's previews, the deployed app stores embeddings + metadata only, not the audio bytes, with link-outs to the original platform.
- **Cost envelope:** ~$0 hosting (Vercel static + free Hugging Face Space CPU Basic, inherited from prior work). Any paid commercial API used has a budget cap (TBD in Decide).
- **Stateless demo** — no accounts, no per-visit persistence.
- **Reuse:** existing audio-ML engineering from `~/Projects/PiedPiper/backend/` (inherited from Soundcheck) carries forward.

## Non-goals

- **No music generation.**
- **No discovery / recommendation surfaces** (would overlap Suno's product team).
- **No user accounts, profiles, or cross-visit persistence.**
- **No automation against Suno's web service** (ToS-violating; wrong signal for a Suno-adjacent application).
- **No claim of full-catalog coverage** — the demo uses a sampled reference set and says so plainly.
- **No musical/aesthetic judgment** — the tool measures *acoustic similarity to existing tracks*; it does not rate whether a song is "good."
- **No exact-recording fingerprint detection (Shazam-style).** AI-generated soundalikes do not trigger fingerprint matches; the problem is similarity, not identity.

## Open questions (to resolve in PRD / Presearch / Decide)

- **Similarity matching technology** — self-built audio embeddings (CLAP, ~90% inherited from Soundcheck), a commercial API (ACRCloud Cover Song Identification), or a hybrid showing both side-by-side. Current recommendation pending PRD: hybrid.
- **Reference catalog source** — Spotify's 30-second preview endpoint is mid-deprecation, which threatens the prior plan. Alternatives: licensed datasets (FMA, MTG-Jamendo), a smaller hand-curated set, or rely on the commercial API's own catalog.
- **Catalog target size** — provisional 500 tracks; revisit based on the chosen catalog source.
- **Similarity verdict thresholds** — needs calibration against observed AI-vs-real similarity distributions.
- **Eval rubric for similarity** — binary "unacceptable copy yes/no" label vs. 4-class verdict label.
- **Eval page visibility** — public or behind a `?dev` query param.
- **HF Space cold-start latency** — known ~30s on first request after long idle; UI mitigates with copy.
