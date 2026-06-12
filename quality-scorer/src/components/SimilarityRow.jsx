import AudioPlayer from './AudioPlayer.jsx'
import { audioUrlFor, artworkUrlFor, fmtPercentile } from '../lib/api.js'

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
  linkOut,
  track,
  isReference = false,
}) {
  const audioUrl = audioUrlFor(track)
  const artworkUrl = artworkUrlFor(track, 100)
  // Per ADR-0001: bar width is driven by calibrated percentile (0-100) when
  // available, falling back to raw cosine * 100 only for old backends without
  // the calibrated fields.
  const useCalibrated = percentileRank != null
  const barPct = useCalibrated
    ? Math.round(percentileRank * 100)
    : Math.round((Number(similarity) || 0) * 1000) / 10
  const widthStyle = { width: `${barPct}%` }
  const percentileText = fmtPercentile(percentileRank)
  const labelShort = (similarityLabel || '').split(' ')[0]
  const cosineForTooltip = (Number(rawCosine ?? similarity) || 0).toFixed(3)

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

      <span className="text-[15px]">
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
