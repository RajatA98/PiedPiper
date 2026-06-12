---
name: CODEX_PHASE_7
description: Phase 7 implementation handoff for Codex — CI + deploy + ship polish. The final phase. Self-contained.
status: Ready
last_updated: 2026-06-11
---

# Phase 7 implementation — CI + deploy + ship polish

**For Codex. Read this file end-to-end, then implement. This is the last phase.**

---

## Quick orientation

Phases 1 + 1.5 + 2 + 3 + 4 + 5 + 6 will be landed when you start. The codebase has:

- A 160-track reference catalog + segment embeddings.
- A FastAPI backend with `/neighbors`, `/analyze`, `/health` returning the locked response shapes, plus ACRCloud integration behind a feature flag.
- A React + Vite frontend with the similarity-first ReportCard, both ACRCloud rows, the quality badge, and the eval page rendering real metrics + named examples.
- A substantive top-level `README.md`.

Phase 7 ships it to a live URL. Three sub-streams:

1. **GitHub Actions** — tests on every push; eval-diff reproducibility check on PR touches.
2. **Deploys** — Hugging Face Space (backend) + Vercel (frontend), wired with secrets and env vars.
3. **Documentation** — UptimeRobot setup (mitigates HF Space 48h sleep), Modal fallback note, and a "how to ship a new corpus or eval" runbook in the README.

The repo already has `deploy/hf_space/` (Dockerfile + app.py) from the Soundcheck era — adapt it; don't recreate it.

---

## Read first

1. **`factory/artifacts/LOCKED_DECISIONS.md`** — sections "Backend hosting", "Frontend hosting / CDN", "Cost discipline".
2. **`factory/artifacts/PROJECT_PLAN.md`** — Phase 7 section.
3. **`deploy/hf_space/`** — the existing Dockerfile + app.py. Update, don't rewrite.
4. **`README.md`** — the top-level README has the architecture story; add a "Run it" appendix + the UptimeRobot section.

---

## Files to implement / modify

### NEW — GitHub Actions

| File | Role |
|---|---|
| `.github/workflows/test.yml` | Runs backend pytest + frontend `npm run build` on every push to any branch. |
| `.github/workflows/eval-check.yml` | Triggered when PR touches `quality-scorer/public/corpus/*` or `backend/eval_input/*`: re-runs `python -m backend.scripts.run_eval` and fails the build if the resulting `eval.json` differs from the committed file. Audit-grade reproducibility loop. |
| `.github/workflows/frontend-vitest.yml` | Runs `npm test` (Vitest unit tests) on every push to any branch. |

The workflows should:
- Use Python 3.11+ for backend (matches `pyproject.toml`).
- Use Node 20 for frontend.
- Cache `pip` and `npm` for speed.
- Run `pip install -e "backend/[runtime,ingest,dev]"` for backend dependencies.
- Skip the CLAP-loading slow tests in CI (use `pytest -m "not slow"` so CI stays fast).

### MODIFY — `deploy/hf_space/`

Update for PiedPiper:

| File | Change |
|---|---|
| `deploy/hf_space/Dockerfile` | Rename `LABEL`s + ensure `pip install -e "backend/[runtime,ingest]"` is the install line. Pin Python version. |
| `deploy/hf_space/app.py` | Should import `from backend.api import app` (the FastAPI instance). If it currently imports from a `soundcheck` module, fix. |
| `deploy/hf_space/README.md` | Rewrite for PiedPiper: title, description, env-var list, "warming up" copy hint. |
| `deploy/hf_space/.env.example` (new) | Document all required env vars: `CORPUS_DIR` (optional), `CORS_ORIGIN`, `ENABLE_ACRCLOUD`, `ACRCLOUD_ACCESS_KEY`, `ACRCLOUD_ACCESS_SECRET`, `ACRCLOUD_HOST`, `ACRCLOUD_AI_DETECTOR_URL`, `ACRCLOUD_AI_DETECTOR_BEARER`, `PIEDPIPER_CLAP_REVISION`. |

### NEW — Vercel config

| File | Role |
|---|---|
| `quality-scorer/vercel.json` | Build settings — root directory `quality-scorer`, output `dist`, framework `vite`. Set `headers` for `corpus.json` / `embeddings.npy` so they're long-cached but revalidate when content hash changes. Set `VITE_API_URL` reference for build-time bake-in. |
| `quality-scorer/.env.example` | Document `VITE_API_URL` — the deployed HF Space URL. |

### ADD to the top-level `README.md`

Append a "## Run it" section if not present (Phase 4's README may already have one — extend it; don't duplicate). Also add:

- **A "Deploy" subsection** — three steps:
  1. Push to GitHub.
  2. Create an HF Space, point it at `deploy/hf_space/`, set the env-var secrets in the HF dashboard from `.env.example`.
  3. Connect Vercel to the repo, set `VITE_API_URL` to the HF Space URL.
- **An "UptimeRobot setup" subsection** — five steps:
  1. Register a free UptimeRobot account.
  2. Add a new HTTPS monitor on `https://<your-hf-space>.hf.space/health`.
  3. Set interval to 30 minutes (HF Space sleeps after 48 h; 30 min keeps it warm with margin).
  4. Done. The Space will stay warm during normal demo windows.
- **A "Modal fallback" paragraph** — describe Modal as a tested fallback if HF cold starts ever feel unacceptable. Don't implement; just document.

---

## Acceptance criteria

1. **Push to `main`** → all three GitHub Actions workflows run; backend tests pass, frontend vitest passes, build succeeds.
2. **HF Space deploys** with the PiedPiper Dockerfile; `/health` returns `ok: true, corpus: 160, segments: 3495, acrcloudEnabled: <bool>`.
3. **Vercel deploys** the static frontend; the URL serves the landing page; uploading an audio file successfully calls the HF Space `/neighbors` and renders a ReportCard.
4. **`eval-check.yml`** correctly fails the build when `eval.json` would differ from the committed file (verify by intentionally tweaking a number and pushing a PR).
5. **README's "Deploy" section** walks a fresh reviewer through reproducing the deploy from scratch in under 30 minutes.

---

## Verification

```bash
# 1. Local CI dry-run — run the workflows' steps in shell:
cd backend && pytest -q -m "not slow" tests/
cd ../quality-scorer && npm install && npm run build && npm test

# 2. Build the HF Space Docker image locally to verify Dockerfile syntax:
docker build -t piedpiper-backend deploy/hf_space/
docker run --rm -p 8000:8000 piedpiper-backend &
curl -s http://localhost:8000/health
kill %1

# 3. Push and watch the Actions runs on GitHub.

# 4. Confirm the HF Space build log shows successful CLAP model download + uvicorn boot.

# 5. Confirm Vercel build log shows successful `npm run build` + asset upload.
```

---

## Constraints — non-negotiable

1. **Secrets server-side only.** Vercel env vars CAN include `VITE_API_URL` (it's the public backend URL — fine to bake in). HF Space secrets MUST include the ACRCloud creds. Neither should appear in any frontend bundle (grep `dist/` for accidental leaks before declaring done).
2. **CI must run fast.** Skip slow tests; the goal is push → green check inside 3 minutes total across all workflows.
3. **The eval-check workflow exists to catch silent drift.** Don't make it skippable for trivial PRs; the audit value is in being uniformly applied.
4. **No emojis in workflow files, docs, or commit messages.**
5. **Don't touch** factory/artifacts/* or any of the previously-shipped Phase code beyond the deploy/ config files.

---

## Edge cases to handle

- **HF Space cold start** — the `/health` ping during the workflow might time out on first deploy. Workflow should wait up to 90 s for `/health` to come up.
- **Vercel build can't find `corpus.json`** — that file lives at `quality-scorer/public/corpus/corpus.json` and Vite serves it from `/corpus/corpus.json`. Make sure `vercel.json` doesn't accidentally exclude `public/corpus/`.
- **The `eval-check.yml` workflow needs CLAP to run `run_eval.py`.** Cache the HuggingFace model directory between runs (`actions/cache@v4` keyed on the pinned model SHA from `manifest.json`) — first run will be slow but subsequent runs are quick.
- **CORS** — `backend/backend/api.py` already allows `*.vercel.app` regex; verify the live Vercel domain matches the pattern. If it's a custom domain, add it.

---

## When you're done

Return a short note (under 300 words):

1. Confirmation of all three CI workflows green on a push to main.
2. The live URLs — HF Space `/health` curl output + the Vercel deployment URL.
3. A screenshot or curl of an end-to-end query through the live URL → `/neighbors` returning a real ReportCard payload.
4. Confirmation that no ACRCloud secret appears in the built frontend bundle (`grep -ri "acrcloud\|bearer\|hmac" quality-scorer/dist/` should return zero hits relevant to credentials).
5. Anything you flagged or had to judgment-call on.

**After Phase 7 lands, the project ships.** The flow becomes:

- Friend sends the resume + the Vercel URL to Suno's Head of Engineering.
- Reviewer clicks the URL → sees the similarity-first PiedPiper UI matching the README story.
- Reviewer drops their own Suno track → sees the AI Music Detector "likely suno" pill render in Suno's rose color.
- Reviewer clicks `/evaluation` → sees real R@1/R@3/MRR + the named FP/FN examples + the limitations paragraph.
- Reviewer clicks the GitHub link → reads the substantive top-level README with the architecture + "what I deliberately left out" sections.

That's the impressive version. This phase is what makes it real.
