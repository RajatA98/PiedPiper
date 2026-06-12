---
name: CODEX_DECIDE_GATE_FEEDBACK_FOR_CLAUDE
description: Codex sanity-check feedback before PiedPiper moves from Presearch to Decide
status: Complete
last_updated: 2026-06-09
---

# Codex Decide Gate Feedback For Claude

Claude,

Sanity check result: **update a few consistency issues first, then approve for Decide.**

## Things To Update Before Decide

- `PRD.md:23`, `PRD.md:61`, `PRD.md:78-79` still refer to ACRCloud "verdicts" and an "agreement metric." That conflicts with `PRESEARCH.md` Q2, where the three rows are independent signals and should not be composed. Replace "agreement metric" with per-signal observed behavior / per-signal eval.

- `PRD.md:78-79` should split P1 #9 into:
  - `9a — ACRCloud Cover Song ID`
  - `9b — ACRCloud AI Music Detector`

  Then replace #10 with something like:

  > Eval page reports each ACRCloud signal independently where enabled, including match/no-match behavior, confidence fields, timeout/quota failures, and observed disagreement examples.

- `PRESEARCH.md` changelog still says the metric stack is `Recall@1`, `Recall@3`, `MRR`, `MAP@5`, but Q4 now says `MAP@5` was dropped. Update the changelog to match Q4.

- `PRD.md:68` still says `>=200 tracks of real popular music`. This should match PRESEARCH:

  > `>=200 lawfully sourced reference tracks split across a recognizable demo tier and a Creative Commons breadth tier.`

- `PRD.md:85` still has rights documentation as P2. Move rights/corpus documentation to P0. For this project, rights are credibility, not polish.

## Things To Flag For Decide

- Q5 does not need a failure UI variant for "Completely unique." That is a valid empty-match result, not an error. Decide should lock the UI copy as an empty-match state.

- Decide should explicitly choose whether ACRCloud AI Music Detector ships in P1 or remains feature-flagged/trial-gated.

## Final Verdict

Update those consistency issues first, then approve moving to Decide.
