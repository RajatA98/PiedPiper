import AudioPlayer from './AudioPlayer.jsx'
import { audioUrlFor, artworkUrlFor, fmtPercentile } from '../lib/api.js'

/**
 * Render the strongest-segment-match timestamp as a compact caption:
 *   "match: 0:30→1:00 ↔ 0:20→0:50"  (query window ↔ catalog window)
 *
 * Returns null when the payload is missing (older backend without the field).
 */
function fmtMatchTimestamp(ts) {
  if (!ts || typeof ts !== 'object') return null
  const fmt = (s) => {
    const n = Math.max(0, Math.floor(Number(s) || 0))
    const m = Math.floor(n / 60)
    const r = n % 60
    return `${m}:${r.toString().padStart(2, '0')}`
  }
  const q = `${fmt(ts.queryStartSec)}–${fmt(ts.queryEndSec)}`
  const c = `${fmt(ts.catalogStartSec)}–${fmt(ts.catalogEndSec)}`
  return `match: query ${q} ↔ track ${c}`
}

/**
 * SimilarityRow — one row in the top-3 closest tracks list.
 *
 * Renders:
 *   [rank]  [▶]  Title — Artist        [───── bar ─────]   87.3%
 *
 * The play button is a compact <AudioPlayer>; it uses the real <audio> element
 * and auto-pauses the others on the page when activated. If the track has no
 * playable audio URL (e.g., un-enriched Jamendo row), the button renders disabled.
 */
export default function SimilarityRow({
  rank,
  title,
  artist,
  similarity,
  percentileRank,
  similarityLabel,
  rawCosine,
  matchTimestamp,
  linkOut,
  track,
  isReference = false,
}) {
  const audioUrl = audioUrlFor(track)
  const artworkUrl = artworkUrlFor(track, 100)
  // Bar width is driven by raw cosine (the actual underlying similarity strength)
  // not percentile rank, because percentile values cluster near the top of the
  // distribution and don't visually communicate spread. Cosine 0.88 vs 0.79 vs
  // 0.71 reads as visibly distinct widths; percentile 0.97 vs 0.94 vs 0.89 does
  // not. The percentile + label are still the headline interpretation; the bar
  // is the raw signal.
  const cosine = Number(rawCosine ?? similarity) || 0
  const useCalibrated = percentileRank != null
  const barPct = useCalibrated
    ? Math.max(2, Math.min(100, Math.round(cosine * 100)))
    : Math.round((Number(similarity) || 0) * 1000) / 10
  const widthStyle = { width: `${barPct}%` }
  const percentileText = fmtPercentile(percentileRank)
  const cosineForTooltip = cosine.toFixed(3)
  const tsText = fmtMatchTimestamp(matchTimestamp)

  return (
    <div
      className="grid items-center gap-3 border-t py-3"
      style={{
        gridTemplateColumns: '18px 40px minmax(160px, 1.4fr) 2fr 52px',
        borderColor: 'var(--color-line)',
        opacity: isReference ? 0.6 : 1,
      }}
    >
      <span
        className="font-mono text-xs"
        style={{ color: 'var(--color-faint)' }}
      >
        {rank}
      </span>

      <AudioPlayer src={audioUrl} compact artwork={artworkUrl} size={40} />

      <span className="flex flex-col">
        <span className="text-[15px] leading-snug">
          {linkOut ? (
            <a
              href={linkOut}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:underline"
              style={{ color: 'inherit' }}
            >
              {title}
            </a>
          ) : (
            title
          )}{' '}
          <span style={{ color: 'var(--color-dim)' }}>— {artist}</span>
        </span>
        {tsText && (
          <span
            className="mt-0.5 font-mono text-[10px] tabular-nums"
            style={{ color: 'var(--color-faint)' }}
            title="Strongest segment match: query window ↔ catalog-track window"
          >
            {tsText}
          </span>
        )}
      </span>

      <span
        className="h-1 rounded-sm"
        style={{ background: 'var(--color-line)' }}
      >
        <span
          className="block h-full rounded-sm"
          style={{
            ...widthStyle,
            background: isReference ? '#9AA0A8' : 'var(--color-accent)',
          }}
        />
      </span>

      <span
        className="text-right font-mono text-[12px] tabular-nums"
        style={{ color: isReference ? 'var(--color-dim)' : 'var(--color-ink)' }}
        title={`raw cosine ${cosineForTooltip}`}
      >
        {useCalibrated ? (
          <>
            <span className="block">{percentileText}</span>
            <span
              className="block text-[10px]"
              style={{ color: 'var(--color-faint)' }}
            >
              cos {cosineForTooltip}
            </span>
          </>
        ) : (
          `${barPct}%`
        )}
      </span>
    </div>
  )
}
