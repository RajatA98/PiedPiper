"""Backend-wide constants. Tunable here without touching analysis code."""

from __future__ import annotations

# --- analysis -----------------------------------------------------------------

ANALYSIS_SR = 22050           # librosa load sample rate (mono signals)
CLAP_SR = 48000               # CLAP processor expects 48 kHz
FRAME_SIZE = 2048
HOP_SIZE = 512
EPS = 1e-7
WAVEFORM_BINS = 180           # the frontend Waveform component expects exactly 180

# --- live-upload caps ---------------------------------------------------------

CLIP_CAP_S = 90               # truncate uploads to 90 s before CLAP encode
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".ogg", ".m4a"}
ALLOWED_MIME_PREFIX = "audio/"

# --- CLAP ---------------------------------------------------------------------

CLAP_MODEL_ID = "laion/larger_clap_music"
# CLAP projects both modalities into a 512-d shared space (verified against the
# loaded model in transformers 5.9.x; the original plan said 1024 by mistake).
CLAP_EMBED_DIM = 512
CLAP_GENRE_TOP_K = 3
CLAP_GENRE_TEMPERATURE = 10.0

# --- windowed encoding (Phase 1 + 2) -----------------------------------------

# 10 s windows of audio fed independently to CLAP, then mean-pooled and L2-
# normalized to produce a single track-level embedding. Matches PROJECT_PLAN
# Phase 1 + 2 acceptance criteria and LOCKED_DECISIONS track-length protocol.
CLAP_WINDOW_SECONDS = 10
# Soft cap on the per-window count; matches existing CLIP_CAP_S=90 above so a
# 90 s query produces at most 9 windows. Catalog inputs (30 s previews) produce 1–3.
CLAP_QUERY_MAX_SECONDS = CLIP_CAP_S
CLAP_POOLING = "l2_normalized_mean"

# Provisional "Completely unique" cutoff carried over from prior project — NO
# published CLAP-512 threshold data exists. Recalibrate from negatives
# distribution after the golden set is built. See PRESEARCH Q1.
SIMILARITY_THRESHOLD_DEFAULT = 0.70

GENRE_LABELS: list[str] = [
    "Synthwave",
    "Lo-fi Hip-Hop",
    "Ambient",
    "Trap",
    "Indie Folk",
    "House",
    "Drum & Bass",
    "Cinematic",
    "Industrial",
    "Jazz Fusion",
    "Phonk",
    "Orchestral",
    "Hyperpop",
    "Dream Pop",
    "Techno",
]
GENRE_PROMPT_TEMPLATE = "a {label} music track"
