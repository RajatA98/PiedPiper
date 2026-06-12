---
name: CODEX_PHASE_1_HANDOFF_FEEDBACK_FOR_CLAUDE
description: Codex review notes on Claude's Phase 1 catalog-ingest implementation handoff
status: Complete
last_updated: 2026-06-10
---

# Codex Phase 1 Handoff Feedback For Claude

Claude,

The Phase 1 handoff is close, but there is a blocking package-layout mismatch before Codex can implement it cleanly.

## Blocking Issue: Module Paths Do Not Match The Actual Package Layout

The prompt says to run:

```bash
python -m backend.scripts.rebuild_corpus
```

And the scaffold imports:

```python
from backend.backend import config
```

But the actual installed package is `backend.config`, not `backend.backend.config`.

Codex confirmed locally:

```text
backend.config OK
backend.backend.config ModuleNotFoundError
backend.scripts.rebuild_corpus ModuleNotFoundError
scripts.rebuild_corpus ModuleNotFoundError due to backend.backend import
```

Affected files:

- `backend/scripts/rebuild_corpus.py` imports `from backend.backend import config`
- `backend/tests/test_corpus_ingest.py` imports `from backend.backend import clap_engine, clap_windowed, config`
- `CODEX_PHASE_1_PROMPT.md` tells Codex to run `python -m backend.scripts.rebuild_corpus`

## Recommended Fix

Pick one layout and make prompt, scaffold, and tests match it.

Preferred option for this repo:

- Move scaffold scripts under the installed package:
  - from `backend/scripts/*.py`
  - to `backend/backend/scripts/*.py`
- Then this works after `pip install -e "backend/[runtime,ingest,dev]"`:

```bash
python -m backend.scripts.rebuild_corpus
```

- Keep imports as:

```python
from backend import config
from backend import clap_engine, clap_windowed
```

- Do not use:

```python
from backend.backend import ...
```

Alternative:

- Keep `backend/scripts/` as loose scripts.
- Add `backend/scripts/__init__.py`.
- Run as `python -m scripts.rebuild_corpus` from the `backend/` directory.
- Fix imports to `from backend import config`.

Codex recommendation: use the preferred option. Package the scripts under `backend/backend/scripts/`. It makes the module path clean and stable.

## Test Command Correction

The prompt's slow-test command says:

```bash
pytest -q -m "" tests/test_corpus_ingest.py
```

Better:

```bash
cd backend
pytest -q tests/test_corpus_ingest.py
pytest -q -m slow tests/test_corpus_ingest.py
```

This matches the repo's marker convention and separates no-ML tests from CLAP-loading tests.

## Verdict

Do not start Codex implementation until this import/module path issue is fixed.

The rest of the Phase 1 prompt is strong: segment embeddings, manifest schema, Apple stream-not-cache rule, and windowing tests are all in the right shape.
