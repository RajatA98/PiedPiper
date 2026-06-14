# PiedPiper — Hugging Face Space (Docker SDK).
#
# Build target: free CPU Basic Space (16 GB RAM / 2 vCPU). The CLAP checkpoint
# is pre-pulled at build time so the first request after a cold wake isn't ~30 s.
# The 160-track reference corpus is baked in so /neighbors works from the first
# request — no separate volume mount needed.
#
# This Dockerfile expects a flat build context populated by `deploy/sync_to_hf.sh`:
#   <staging>/Dockerfile
#   <staging>/README.md           (HF Space metadata + docs)
#   <staging>/app.py              (uvicorn entrypoint, re-exports backend.api:app)
#   <staging>/requirements.txt
#   <staging>/backend/...         (the backend Python package)
#   <staging>/corpus/...          (mean + segment embeddings + eval.json)
#   <staging>/eval_audio/...      (named-example previews)
#
# Image footprint is ~5–6 GB once weights are baked in; HF allows this on free tier.

FROM python:3.11-slim

# Audio decode + DSP shared libs librosa+soundfile need.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# CPU torch from the official wheel index — avoids pulling CUDA wheels.
RUN pip install --no-cache-dir torch>=2.4 --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend /app/backend
COPY app.py /app/app.py

# The backend's _default_corpus_dir resolves to /app/quality-scorer/public/corpus
# at runtime — copy the files there rather than setting CORPUS_DIR so the default
# path keeps working.
COPY corpus /app/quality-scorer/public/corpus
COPY eval_audio /app/quality-scorer/public/eval_audio

# ADR-0002: pre-pull MuQ-MuLan weights at build time so the first /neighbors
# after a cold wake doesn't have to download ~2.8 GB. The pre-pull also caches
# the XLM-RoBERTa text encoder MuQ-MuLan depends on.
RUN python -c "from muq import MuQMuLan; MuQMuLan.from_pretrained('OpenMuQ/MuQ-MuLan-large')"

ENV PORT=7860 HF_HOME=/app/.hf_cache
# The corpus copy target above is /app/quality-scorer/public/corpus. The
# Python default would resolve to /quality-scorer/public/corpus inside the
# flattened container layout (parents[2] of /app/backend/api.py is /, not /app),
# so override explicitly.
ENV CORPUS_DIR=/app/quality-scorer/public/corpus
EXPOSE 7860

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
