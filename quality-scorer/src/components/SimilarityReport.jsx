/**
 * SimilarityReport — the headline block: top match + top-3 list, or "Completely unique".
 *
 * The single most important visual artifact in the app. Renders Case A or Case B
 * based on the `caseA` boolean (derived in api.js → deriveHeadline).
 *
 * Visual contract: ui_mockup_v2_suno_flare.html `#report-A` (Case A) and
 * `#report-B` (Case B) blocks.
 *
 * Case A — top match crosses the threshold:
 *   TOP MATCH
 *   87%   similar to
 *   Blinding Lights — The Weeknd                          [↗ open in iTunes]
 *
 *   TOP 3 CLOSEST IN CATALOG
 *   1. Blinding Lights — The Weeknd      ███████░  87%
 *   2. Save Your Tears — The Weeknd      █████░░░  72%
 *   3. Take On Me — a-ha                 ████░░░░  68%
 *
 * Case B — no match crosses the threshold:
 *   RESULT
 *   Completely unique
 *   No close matches in our reference catalog
 *
 *   CLOSEST TRACKS · FOR REFERENCE, NOT MATCHES
 *   1. Pompeii — Bastille                 ███░░░░░  58%   (muted)
 *   ...
 *
 * The Case B empty-state copy is LOCKED — it must match the string in
 * LOCKED_DECISIONS exactly: "Completely unique — this track doesn't sound
 * like anything in our reference catalog".
 *
 * @param {Object} props
 * @param {boolean} props.caseA         - true → Case A, false → Case B
 * @param {Array}   props.neighbors     - response.neighbors (already top-3 sliced)
 * @param {number}  props.topPct        - rounded headline percentage for Case A
 */
import SimilarityRow from './SimilarityRow.jsx'

const EMPTY_HEADLINE = "Completely unique"
const EMPTY_SUBHEAD =
  "this track doesn't sound like anything in our reference catalog"

export default function SimilarityReport({ caseA, neighbors, topPct }) {
  const top = neighbors?.[0]
  const top3 = (neighbors ?? []).slice(0, 3)

  // ---- Case A — match above threshold -------------------------------------
  if (caseA && top) {
    return (
      <section>
        <Kicker>TOP MATCH</Kicker>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className="font-display tabular-nums"
                style={{
                  fontSize: '64px',
                  lineHeight: 0.9,
                  fontWeight: 700,
                  letterSpacing: '-0.04em',
                  color: 'var(--color-accent)',
                }}
              >
                {topPct}%
              </span>
              <span className="text-base" style={{ color: 'var(--color-dim)' }}>
                similar to
              </span>
            </div>
            <div
              className="mt-1.5 font-display"
              style={{
                fontSize: '32px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              {top.track?.title ?? top.trackId} —{' '}
              <span style={{ color: 'var(--color-dim)' }}>
                {top.track?.artist ?? 'Unknown artist'}
              </span>
            </div>
          </div>

          {/* TODO(codex): when top.track.attribution_required is true,
              link to top.track.track_view_url with "[↗ open in iTunes]". */}
          {top.track?.track_view_url && (
            <a
              href={top.track.track_view_url}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap pt-2 font-mono text-[12px] no-underline"
              style={{ color: 'var(--color-dim)' }}
            >
              [↗ open in iTunes]
            </a>
          )}
        </div>

        <div className="mt-8">
          <Kicker>TOP 3 CLOSEST IN CATALOG</Kicker>
          <div className="mt-2">
            {top3.map((n, i) => (
              <SimilarityRow
                key={n.trackId ?? i}
                rank={i + 1}
                title={n.track?.title ?? n.trackId}
                artist={n.track?.artist ?? ''}
                similarity={n.meanPooledSimilarity}
                linkOut={n.track?.track_view_url ?? n.track?.source_url}
                track={n.track}
              />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // ---- Case B — completely unique -----------------------------------------
  return (
    <section>
      <div className="text-center">
        <Kicker className="mx-auto block">RESULT</Kicker>
        <div
          className="mt-2 font-display"
          style={{
            fontSize: '64px',
            lineHeight: 0.9,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'var(--color-ink)',
          }}
        >
          {EMPTY_HEADLINE}
        </div>
        <div className="mt-2 text-base" style={{ color: 'var(--color-dim)' }}>
          {EMPTY_SUBHEAD}
        </div>
      </div>

      {top3.length > 0 && (
        <div className="mt-8">
          <Kicker>CLOSEST TRACKS · FOR REFERENCE, NOT MATCHES</Kicker>
          <div className="mt-2">
            {top3.map((n, i) => (
              <SimilarityRow
                key={n.trackId ?? i}
                rank={i + 1}
                title={n.track?.title ?? n.trackId}
                artist={n.track?.artist ?? ''}
                similarity={n.meanPooledSimilarity}
                linkOut={n.track?.track_view_url ?? n.track?.source_url}
                track={n.track}
                isReference
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Kicker({ children, className = '' }) {
  return (
    <span
      className={`font-mono text-[12px] uppercase ${className}`}
      style={{
        color: 'var(--color-faint)',
        letterSpacing: '0.14em',
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  )
}
