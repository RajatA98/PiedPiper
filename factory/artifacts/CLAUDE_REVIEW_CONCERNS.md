---
name: CLAUDE_REVIEW_CONCERNS
description: Review checklist for Claude to validate whether PiedPiper's artifact matches the Suno-facing problem statement
status: Draft
last_updated: 2026-06-03
---

# Claude Review Concerns — PiedPiper

## Review Goal

Evaluate whether the current PiedPiper artifact is compelling and coherent for a Suno Head of Engineering audience.

The core question is not "is this a useful app?" It is:

> Does the shipped artifact visibly deliver the Problem Statement's thesis: a pre-publish acoustic similarity scanner for AI-generated music?

## Context

The Problem Statement defines PiedPiper as:

- A web app for checking whether an AI-generated track sounds acoustically similar to an existing real song.
- A portfolio piece aimed at technical reviewers at AI-music companies, especially Suno.
- A system whose headline output is closest-match similarity, top neighbors, and a risk/verdict.
- A secondary use of the inherited Soundcheck broken-output detector as a small quality status badge.

Current repo evidence suggests a possible mismatch:

- `factory/artifacts/PROBLEM_SUMMARY.md` pitches PiedPiper as a real-song similarity checker.
- `quality-scorer/README.md`, `quality-scorer/src/pages/ScorerPage.jsx`, and `quality-scorer/src/components/ReportCard.jsx` still present Soundcheck as a technical-quality scorer.
- `backend/backend/api.py` has a `/neighbors` endpoint for similarity search, but `quality-scorer/src/lib/api.js` only calls `/analyze`.
- The visible app appears to make silence/clipping/noise/truncation the main report, not acoustic similarity.

## Main Concerns To Check

### 1. Product thesis mismatch

Check whether the deployed/user-visible app makes similarity the headline capability.

Expected if aligned:

- First-screen copy is about acoustic similarity, not only technical soundness.
- Uploading or choosing an example returns a closest-match report.
- The report shows top match, top 3 neighbors, similarity percentages, and a clear verdict such as unique, related, similar, or near-duplicate.
- Technical quality appears as a secondary badge or expandable detail.

Risk if not aligned:

- A Suno reviewer sees a generic generated-audio quality checker rather than the copyright/similarity risk scanner promised by the Problem Statement.

### 2. Overclaiming "real popular song" coverage

Check whether the app actually indexes real existing popular songs, and whether the catalog source is lawful and clearly documented.

Expected if aligned:

- The reference catalog is described precisely.
- If it is a demo/sampled catalog, the UI and README say that plainly.
- The artifact avoids implying full commercial/popular-song coverage unless it exists.
- No source audio is redistributed if licensing does not allow it.

Risk if not aligned:

- The Problem Statement promises "real, existing popular song" matching, but the implementation only has synthetic examples or a small non-commercial dataset.
- This creates credibility risk with an engineering leader, who will immediately question catalog rights, coverage, and false positives.

### 3. Similarity eval gap

Check whether the evaluation page measures the similarity detector, not only the broken-output detector.

Expected if aligned:

- Evaluation includes similarity-specific metrics such as top-k retrieval accuracy, threshold calibration, precision/recall by verdict class, false-positive examples, and false-negative examples.
- The eval explains the size and labeling method of the similarity golden set.
- Thresholds for unique/related/similar/near-duplicate are justified with observed data.

Risk if not aligned:

- The app says "measured, not claimed," but only measures technical brokenness.
- The main similarity claim remains unvalidated.

### 4. Legal/framing precision

Check whether the product language avoids overclaiming legal conclusions.

Expected if aligned:

- Language frames the tool as an acoustic similarity or pre-publish risk scanner.
- It does not claim to determine copyright infringement.
- It makes clear that production use would require a licensed/internal catalog and more calibration.

Risk if not aligned:

- "Copyright detector" framing may sound naive or legally overbroad.
- Stronger framing: "pre-publish acoustic similarity risk scanner."

### 5. Backend/frontend integration

Check whether the frontend actually calls the similarity endpoint.

Expected if aligned:

- Frontend API layer includes a `/neighbors` call.
- The upload flow uses that endpoint for the primary report.
- Report data shape includes query track, neighbors, topSimilarity, and verdict.
- Example tracks can demonstrate similarity without requiring a live upload.

Risk if not aligned:

- Similarity exists as a backend affordance but is invisible to the reviewer.

### 6. Naming and artifact consistency

Check whether the app consistently presents itself as PiedPiper rather than Soundcheck, unless Soundcheck is intentionally a named subsystem.

Expected if aligned:

- App name, README, deployed Space metadata, page titles, and navigation match the PiedPiper thesis.
- "Soundcheck" is either removed or explicitly described as the render-integrity subsystem.

Risk if not aligned:

- The project feels like an older artifact with a new problem statement pasted on top.

## Recommended Claude Verdict Format

Claude should answer with:

1. **Overall assessment:** Ready / promising but misaligned / not ready.
2. **Top 3 blockers:** The issues most likely to weaken the Suno Head-of-Engineering signal.
3. **Evidence:** File paths and concrete UI/backend references.
4. **Fix priority:** What should be changed before the artifact is shown.
5. **Revised positioning:** One concise product framing that fits what is actually implemented.

## My Current Hypothesis

The thesis is strong and well-targeted for Suno, but the artifact likely needs alignment work before it will land.

The most important change is to make similarity the visible first-order product:

> Upload AI-generated audio -> see closest reference match, similarity percentage, top neighbors, and calibrated risk verdict.

The broken-output detector should remain, but only as a secondary quality check.
