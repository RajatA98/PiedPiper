"""FastAPI service — `POST /analyze`, `POST /neighbors`, `GET /health`.

The lifespan startup loads CLAP **and** the corpus (`corpus.json` +
`embeddings.npy` + `segment_embeddings.npz`) once into memory so similarity
queries are microsecond-fast.

Endpoints:
  - `/analyze`   — single-track scoring (Soundcheck): the technical-quality gate.
  - `/neighbors` — similarity audit (Twin Check): given an uploaded track, return
    the top-k most similar tracks already in the catalog with mean-pooled and
    max-segment similarity metrics.

Errors are returned as `{"error": "<code>"}` to match the frontend's `api.js`:
  - `unsupported_media` (415) — wrong mime / extension
  - `empty_file`        (422) — zero-byte upload
  - `file_too_large`    (413) — > MAX_UPLOAD_BYTES (~50 MB)
  - `decode_failed`     (422) — librosa couldn't decode
  - `empty_audio`       (422) — decoded but no samples
"""

from __future__ import annotations

import io
import json
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ADR-0002: clap_engine is no longer the primary encoder; muq_engine took its
# place via clap_windowed's swap. We still import clap_engine here only because
# legacy code paths may reference it; the encoder load + genre tagging both go
# through muq_engine.
from . import __version__, acrcloud_engine, muq_engine, clap_windowed, config, similarity
from .librosa_engine import analyze_array
from .scoring import compute_report

# Optional Sentry error tracking. No-op when SENTRY_DSN is unset.
_sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if _sentry_dsn:
    import sentry_sdk
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        release=__version__,
    )

# CPU torch isn't reliably thread-safe; serialize CLAP encodes.
_clap_lock = threading.Lock()

# In-memory corpus for /neighbors. Loaded once at startup.
_corpus_tracks: list[dict] = []
_corpus_embeddings: np.ndarray | None = None
_corpus_by_id: dict[str, dict] = {}
_flat_catalog: similarity.FlatCatalog | None = None
_catalog_cosine_distribution: np.ndarray | None = None  # sorted upper-tri off-diag pairwise cosines
_model_sha: str = ""
_threshold_default: float = config.SIMILARITY_THRESHOLD_DEFAULT


def _default_corpus_dir() -> Path:
    """Search for the corpus next to the repo's quality-scorer/."""
    here = Path(__file__).resolve()
    # backend/backend/api.py → repo_root/quality-scorer/public/corpus
    return here.parents[2] / "quality-scorer" / "public" / "corpus"


def _load_corpus() -> None:
    """Populate corpus globals from disk if all corpus artifacts are present."""
    global _corpus_tracks, _corpus_embeddings, _corpus_by_id, _flat_catalog
    global _catalog_cosine_distribution
    global _model_sha, _threshold_default
    corpus_dir = Path(os.getenv("CORPUS_DIR", str(_default_corpus_dir())))
    cpath = corpus_dir / "corpus.json"
    epath = corpus_dir / "embeddings.npy"
    spath = corpus_dir / "segment_embeddings.npz"
    mpath = corpus_dir / "manifest.json"
    missing = [p.name for p in (cpath, epath, spath, mpath) if not p.exists()]
    if missing:
        print(
            f"[api] corpus not found at {corpus_dir} "
            f"(missing: {', '.join(missing)}) "
            f"— /neighbors will return no_corpus"
        )
        _corpus_tracks = []
        _corpus_embeddings = None
        _corpus_by_id = {}
        _flat_catalog = None
        _model_sha = ""
        _threshold_default = config.SIMILARITY_THRESHOLD_DEFAULT
        return
    try:
        data = json.loads(cpath.read_text())
        _corpus_tracks = data if isinstance(data, list) else data.get("tracks", [])
        _corpus_embeddings = np.load(epath).astype(np.float32)
        with np.load(spath) as npz:
            segment_embeddings = {k: npz[k].astype(np.float32) for k in npz.files}
        manifest = json.loads(mpath.read_text())
        _model_sha = str(manifest.get("model_sha") or "unpinned")
        if _model_sha == "unpinned":
            print("[api] WARNING manifest missing model_sha; using 'unpinned'")
        _threshold_default = similarity.threshold_from_manifest(manifest)
        _flat_catalog = similarity.build_flat_catalog(_corpus_tracks, _corpus_embeddings, segment_embeddings)
        _catalog_cosine_distribution = similarity.compute_catalog_distribution(_flat_catalog)
        _corpus_by_id = {str(row["track_id"]): row for row in _corpus_tracks if row.get("track_id")}
        if _corpus_embeddings.shape[0] != len(_corpus_tracks):
            print(
                f"[api] WARNING corpus length {len(_corpus_tracks)} ≠ embeddings rows "
                f"{_corpus_embeddings.shape[0]} — /neighbors may be inconsistent"
            )
        print(
            f"[api] corpus loaded: {len(_corpus_tracks)} tracks · "
            f"embeddings {_corpus_embeddings.shape} · segments {_flat_catalog.segs_flat.shape[0]}"
        )
    except Exception as e:
        print(f"[api] corpus load failed: {e!r}")
        _corpus_tracks = []
        _corpus_embeddings = None
        _corpus_by_id = {}
        _flat_catalog = None
        _catalog_cosine_distribution = None
        _model_sha = ""
        _threshold_default = config.SIMILARITY_THRESHOLD_DEFAULT


@asynccontextmanager
async def lifespan(_app):
    muq_engine.load()
    _load_corpus()
    yield


app = FastAPI(title="PiedPiper", version=__version__, lifespan=lifespan)

_CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_CORS_ORIGIN],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# --- shared validation + decode + analyze --------------------------------------

def _err(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code})


def _validate_upload(file: UploadFile, raw: bytes) -> JSONResponse | None:
    ext = Path(file.filename or "").suffix.lower()
    mime = (file.content_type or "").lower()
    if ext not in config.ALLOWED_EXTENSIONS and not mime.startswith(config.ALLOWED_MIME_PREFIX):
        return _err(415, "unsupported_media")
    if not raw:
        return _err(422, "empty_file")
    if len(raw) > config.MAX_UPLOAD_BYTES:
        return _err(413, "file_too_large")
    return None


def _decode_and_pipeline(raw: bytes, ext: str = "") -> dict | JSONResponse:
    """Decode bytes; run librosa + CLAP; return all artifacts (analysis, embedding, genres, report).

    Returns a dict or a JSONResponse on error.

    `ext` is the upload's file extension (e.g. ".m4a"). It's used only as the
    suffix on the temp-file fallback path: when librosa.load on a BytesIO
    fails for an AAC-LC `.m4a` upload (libsndfile can't decode AAC, and
    audioread's ffmpeg fallback requires a path not a BytesIO), we write the
    bytes to a temp file with the right suffix and retry. The suffix matters
    because ffmpeg's format dispatch is partially extension-driven.
    """
    try:
        duration_full = float(sf.info(io.BytesIO(raw)).duration)
    except Exception:
        duration_full = None
    try:
        y, sr = librosa.load(io.BytesIO(raw), sr=config.ANALYSIS_SR, mono=False)
    except Exception:
        # AAC-LC `.m4a` / other libsndfile-unsupported formats hit this path.
        # Write to a temp file (with the upload's extension as the suffix) and
        # retry — audioread will then dispatch to ffmpeg with a real path.
        import tempfile
        suffix = ext if ext and ext.startswith(".") else ""
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
                tmp.write(raw)
                tmp.flush()
                y, sr = librosa.load(tmp.name, sr=config.ANALYSIS_SR, mono=False)
        except Exception:
            return _err(422, "decode_failed")
    if (y if y.ndim == 1 else y).shape[-1] == 0:
        return _err(422, "empty_audio")

    analysis = analyze_array(y, sr, duration_override=duration_full)
    mono = librosa.to_mono(y) if y.ndim > 1 else y
    cap_n = int(config.CLIP_CAP_S * sr)
    if mono.shape[-1] > cap_n:
        mono = mono[:cap_n]
    acrcloud_n = int(15 * sr)
    acrcloud_slice = mono[:acrcloud_n]
    acrcloud_buf = io.BytesIO()
    sf.write(acrcloud_buf, acrcloud_slice, sr, format="WAV", subtype="PCM_16")
    with _clap_lock:
        emb, segment_embeddings = clap_windowed.encode_windowed(mono, sr, max_seconds=None)
    genres = muq_engine.top_genres(emb)
    report = compute_report(analysis["raw"])

    return {
        "analysis": analysis,
        "report": report,
        "genres": genres,
        "emb": emb,
        "segment_embeddings": segment_embeddings,
        "acrcloud_audio": acrcloud_buf.getvalue(),
    }


def _build_track(file: UploadFile, pipeline: dict, *, source: str, id_: str) -> dict:
    return {
        "id": id_,
        "title": Path(file.filename or id_).stem or id_,
        "genre": pipeline["genres"][0][0] if pipeline["genres"] else None,
        "genres": [{"label": lbl, "score": float(s)} for lbl, s in pipeline["genres"]],
        "durationSec": pipeline["analysis"]["durationSec"],
        "source": source,
        "waveform": pipeline["analysis"]["waveform"],
        "problems": pipeline["analysis"]["problems"],
        **pipeline["report"],
    }


# --- endpoints -----------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "model": muq_engine.model_id(),
        "modelSha": _model_sha,
        "version": __version__,
        "corpus": len(_corpus_tracks),
        "segments": int(_flat_catalog.segs_flat.shape[0]) if _flat_catalog else 0,
        "acrcloudEnabled": acrcloud_engine.is_enabled(),
    }


@app.post("/analyze")
async def analyze_endpoint(file: UploadFile = File(...)):
    raw = await file.read()
    if (err := _validate_upload(file, raw)) is not None:
        return err
    ext = Path(file.filename or "").suffix.lower()
    pipeline = _decode_and_pipeline(raw, ext=ext)
    if isinstance(pipeline, JSONResponse):
        return pipeline
    return _build_track(file, pipeline, source="upload", id_="upload")


@app.post("/neighbors")
async def neighbors_endpoint(file: UploadFile = File(...), k: int = 5):
    """Similarity audit: top-k nearest tracks in the catalog."""
    raw = await file.read()
    if (err := _validate_upload(file, raw)) is not None:
        return err
    ext = Path(file.filename or "").suffix.lower()
    pipeline = _decode_and_pipeline(raw, ext=ext)
    if isinstance(pipeline, JSONResponse):
        return pipeline
    query_track = _build_track(file, pipeline, source="upload", id_="upload")

    if _flat_catalog is None:
        return {
            "query": query_track,
            "neighbors": [],
            "verdict": "no_corpus",
            "topMeanPooledSimilarity": 0.0,
            "topMaxSegmentSimilarity": 0.0,
            "modelSha": _model_sha,
            "thresholdDefault": _threshold_default,
            "acrcloud": acrcloud_engine.to_response_dict(acrcloud_engine.disabled_response()),
        }

    neighbors = similarity.top_k_neighbors(
        pipeline["emb"].astype(np.float32),
        pipeline["segment_embeddings"].astype(np.float32),
        _flat_catalog,
        k=k,
    )

    # ADR-0001: calibrate raw cosines against the catalog distribution so the
    # UI can render meaningful labels instead of "99.8% / 99.7% / 99.7%".
    distribution = _catalog_cosine_distribution if _catalog_cosine_distribution is not None else np.empty((0,), dtype=np.float32)
    for nb in neighbors:
        nb["track"] = _corpus_by_id.get(nb["trackId"], {})
        raw = float(nb["meanPooledSimilarity"])
        seg = float(nb["maxSegmentSimilarity"])
        pct = similarity.cosine_to_percentile(raw, distribution)
        nb["rawCosine"] = raw
        nb["percentileRank"] = float(pct)
        nb["similarityLabel"] = similarity.similarity_label(pct)
        nb["segmentSupport"] = seg
        # Calibrated 0-1 score for the UI bar width — uses percentile rank.
        nb["calibratedScore"] = float(pct)
        # Timestamp of the strongest segment match — what part of the query
        # lined up with what part of the catalog track. Window indices come
        # straight out of similarity.top_k_neighbors; we convert to seconds
        # using the locked 10 s window protocol.
        q_win = int(nb.pop("matchQueryWindow", 0))
        c_win = int(nb.pop("matchCatalogWindow", 0))
        win_s = float(config.CLAP_WINDOW_SECONDS)
        nb["matchTimestamp"] = {
            "queryStartSec": q_win * win_s,
            "queryEndSec": (q_win + 1) * win_s,
            "catalogStartSec": c_win * win_s,
            "catalogEndSec": (c_win + 1) * win_s,
            "windowSeconds": win_s,
        }

    specificity = float(similarity.query_specificity(pipeline["emb"].astype(np.float32), _flat_catalog))
    acr = acrcloud_engine.call_for_query(pipeline["acrcloud_audio"])

    return {
        "query": query_track,
        "neighbors": neighbors,
        "topMeanPooledSimilarity": float(neighbors[0]["meanPooledSimilarity"]) if neighbors else 0.0,
        "topMaxSegmentSimilarity": float(neighbors[0]["maxSegmentSimilarity"]) if neighbors else 0.0,
        "topPercentileRank": float(neighbors[0]["percentileRank"]) if neighbors else 0.0,
        "topSimilarityLabel": neighbors[0]["similarityLabel"] if neighbors else "weak",
        "querySpecificity": specificity,
        "modelSha": _model_sha,
        "thresholdDefault": _threshold_default,
        "acrcloud": acrcloud_engine.to_response_dict(acr),
    }


def run() -> None:
    """Convenience launcher: `python -m backend.api` or `uvicorn backend.api:app`."""
    import uvicorn

    uvicorn.run(
        "backend.api:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )


if __name__ == "__main__":
    run()
