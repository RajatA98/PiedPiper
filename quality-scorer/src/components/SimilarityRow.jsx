/**
 * SimilarityRow — one row in the top-3 closest tracks list.
 *
 * Visual contract: ui_mockup_v2_suno_flare.html, `.sim-row` block.
 *
 * Renders:
 *   [rank]  Title — Artist        [───── bar ─────]   87%
 *
 * Muted variant (`isReference={true}`) is used in Case B for the "for reference,
 * not matches" tracks under the "Completely unique" headline. Same shape, ~60%
 * opacity, no green accent on the bar.
 *
 * @param {Object} props
 * @param {number} props.rank        - 1-indexed rank in the top-3.
 * @param {string} props.title       - track title.
 * @param {string} props.artist      - track artist.
 * @param {number} props.similarity  - cosine [0, 1] from neighbors[].meanPooledSimilarity.
 * @param {string} [props.linkOut]   - URL to the source platform (iTunes / Jamendo).
 * @param {boolean} [props.isReference=false] - muted styling for Case B "closest tracks" block.
 */
export default function SimilarityRow({
  rank,
  title,
  artist,
  similarity,
  linkOut,
  isReference = false,
}) {
  const pct = Math.round((Number(similarity) || 0) * 1000) / 10
  const widthStyle = { width: `${pct}%` }

  return (
    <div
      className="grid items-center gap-3 border-t py-3"
      style={{
        gridTemplateColumns: '18px minmax(180px, 1.4fr) 2fr 52px',
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

      <span className="text-[15px]">
        {/* TODO(codex): when linkOut is provided, wrap title+artist in an <a>.
            Use Apple/iTunes attribution requirement from corpus.json's
            attribution_required field — show a small "iTunes ↗" hint inline. */}
        {title} <span style={{ color: 'var(--color-dim)' }}>— {artist}</span>
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
        className="text-right font-mono text-[13px] tabular-nums"
        style={{ color: isReference ? 'var(--color-dim)' : 'var(--color-ink)' }}
      >
        {pct}%
      </span>
    </div>
  )
}
