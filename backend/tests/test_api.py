"""FastAPI `/analyze` smoke via TestClient.

All tests marked `slow` because the lifespan startup loads CLAP (~2 GB). Once
the model is cached locally, the suite runs in a few seconds.
"""

from __future__ import annotations

import io

import numpy as np
import pytest
import soundfile as sf


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from backend.api import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def clean_wav_bytes() -> bytes:
    sr = 22050
    t = np.linspace(0, 5.0, int(sr * 5.0), endpoint=False, dtype=np.float32)
    sine = (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, sine, sr, format="WAV")
    return buf.getvalue()


@pytest.mark.slow
def test_health(client) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert "model" in body
    assert "version" in body


@pytest.mark.slow
def test_analyze_returns_track_shape(client, clean_wav_bytes) -> None:
    r = client.post(
        "/analyze",
        files={"file": ("test.wav", clean_wav_bytes, "audio/wav")},
    )
    assert r.status_code == 200, r.text
    track = r.json()
    assert track["id"] == "upload"
    assert track["source"] == "upload"
    assert track["title"] == "test"
    assert isinstance(track["genre"], str)
    assert len(track["genres"]) == 3
    assert all("label" in g and "score" in g for g in track["genres"])
    assert len(track["waveform"]) == 180
    assert all(0.0 <= v <= 1.0 for v in track["waveform"])
    assert len(track["signals"]) == 7
    assert track["verdict"] in ("keep", "drop")


@pytest.mark.slow
def test_analyze_rejects_bad_mime(client) -> None:
    r = client.post(
        "/analyze",
        files={"file": ("not_audio.txt", b"this is not audio", "text/plain")},
    )
    assert r.status_code == 415
    assert r.json() == {"error": "unsupported_media"}


@pytest.mark.slow
def test_analyze_rejects_undecodable(client) -> None:
    r = client.post(
        "/analyze",
        files={"file": ("broken.wav", b"not a real wav", "audio/wav")},
    )
    assert r.status_code == 422
    assert r.json() == {"error": "decode_failed"}


@pytest.mark.slow
def test_analyze_rejects_empty(client) -> None:
    r = client.post(
        "/analyze",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert r.status_code == 422
    assert r.json() == {"error": "empty_file"}
