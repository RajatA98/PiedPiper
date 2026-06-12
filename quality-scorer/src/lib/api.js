// Single seam between the React app and the Python backend.
//
// `VITE_API_URL` bakes into the bundle at build time:
//   - Dev (.env.local):       http://localhost:8000
//   - Prod (.env.production): https://<your-hf-username>-piedpiper.hf.space
//
// If unset, falls back to relative `/analyze` (same-origin) — useful for the
// all-in-one HF Space deploy where the static site is served by the API host.
export const API_BASE = import.meta.env.VITE_API_URL || ''

/**
 * POST a File to `/analyze` and return the full Track-shape JSON.
 * Throws Error(message) on non-2xx; the page maps that to the `ErrorState` UI.
 *
 * Phase 3+: `/analyze` is retained for the inherited 7-signal quality badge.
 * The new headline (similarity) flow uses `neighborsUpload` below.
 */
export async function analyzeUpload(file) {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd })
  if (!r.ok) {
    let detail = ''
    try {
      const body = await r.json()
      detail = body?.error || ''
    } catch {
      /* not json */
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return r.json()
}

/**
 * POST a File to `/neighbors` and return the similarity report.
 *
 * Phase 2 backend response shape (locked):
 * {
 *   query: { ... },                          // Track-shape echo of the upload (id, title, durationSec, ...)
 *   neighbors: [
 *     {
 *       trackId: string,                     // e.g. "tier1:itunes:1499378034"
 *       meanPooledSimilarity: number,        // cosine [-1, 1], the ranking signal
 *       maxSegmentSimilarity: number,        // cosine [-1, 1], local-resemblance secondary
 *       track: { title, artist, source, ... } // catalog metadata attached server-side
 *     },
 *     ...                                    // length min(k, N), sorted by meanPooledSimilarity desc
 *   ],
 *   topMeanPooledSimilarity: number,         // == neighbors[0].meanPooledSimilarity for convenience
 *   topMaxSegmentSimilarity: number,         // == neighbors[0].maxSegmentSimilarity
 *   modelSha: string,                        // pinned CLAP revision SHA from manifest.json
 *   thresholdDefault: number,                // "Completely unique" cutoff (provisional 0.70)
 *   // OR, when the catalog isn't loaded:
 *   verdict: "no_corpus",
 *   neighbors: []
 * }
 *
 * Frontend applies the threshold rule: if topMeanPooledSimilarity >= thresholdDefault
 * → render Case A headline (`{pct}% similar to {title} — {artist}`).
 * Otherwise → render Case B (`"Completely unique — this track doesn't sound like
 * anything in our reference catalog"`).
 *
 * @param {File} file - the audio file to analyze (mp3/wav/flac/ogg/m4a, ≤50MB)
 * @param {number} [k=5] - number of neighbors to return
 * @returns {Promise<object>} the neighbors response (see shape above)
 * @throws {Error} on non-2xx with the backend's `error` field as the message
 */
export async function neighborsUpload(file, k = 5) {
  const fd = new FormData()
  fd.append('file', file)
  const qs = k === 5 ? '' : `?k=${encodeURIComponent(k)}`
  const r = await fetch(`${API_BASE}/neighbors${qs}`, {
    method: 'POST',
    body: fd,
  })
  if (!r.ok) {
    let detail = ''
    try {
      const body = await r.json()
      detail = body?.error || ''
    } catch {
      /* not json */
    }
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return r.json()
}

/**
 * Pull the artwork URL out of a catalog track, scaled to the requested size.
 *
 * iTunes URLs end with `/100x100bb.jpg` — we can request larger by string-replace.
 * Jamendo URLs (added during the Phase 7.5 enrichment) come pre-sized at 300x300.
 *
 * Returns null when no artwork is available (renders a placeholder tile).
 */
export function artworkUrlFor(track, size = 100) {
  if (!track) return null
  const url = track.artwork_url ?? track.artworkUrl ?? null
  if (!url) return null
  // iTunes pattern — replace the trailing /NNNxNNNbb.jpg with desired size.
  return url.replace(/\d+x\d+bb\.jpg$/, `${size}x${size}bb.jpg`)
}

/**
 * Pull the playable audio URL out of a catalog track, if any.
 *
 * Returns:
 *   - string URL  → for iTunes (previewUrl, 30s m4a) or Jamendo (audioStreamUrl from enrichment)
 *   - null        → no playable audio for this track (renders the play button disabled)
 *
 * Pure function. Component-agnostic. Future sources just add a new key here.
 */
export function audioUrlFor(track) {
  if (!track) return null
  const ext = track.external_ids ?? track.externalIds ?? {}
  return (
    ext.previewUrl
    ?? ext.jamendoAudioUrl
    ?? ext.jamendoStreamUrl
    ?? track.preview_url
    ?? null
  )
}

/**
 * Apply the locked threshold rule to a /neighbors response.
 * Returns { caseA: bool, topPct: number|null, topMatch: object|null }.
 *
 * Pure function — components consume it for headline rendering without
 * re-encoding the threshold logic per-component.
 */
export function deriveHeadline(response) {
  if (!response || response.verdict === 'no_corpus' || !response.neighbors?.length) {
    return { caseA: false, topPct: null, topMatch: null }
  }
  const top = response.neighbors[0]
  const sim = response.topMeanPooledSimilarity ?? top.meanPooledSimilarity ?? 0
  const threshold = response.thresholdDefault ?? 0.70
  return {
    caseA: sim >= threshold,
    topPct: Math.round(sim * 1000) / 10,
    topMatch: top,
  }
}
