/**
 * ExampleChips — sidecar card of 3 staged example tracks.
 *
 * Reads from `/corpus/examples.json` (Phase 1 ingest output). Each chip is a
 * row with: a thin colored status bar + monospace 6–8 char chipLabel + the
 * track title in lighter text.
 *
 * Phase 1 currently produces `examples.json = []` because Suno example audio
 * isn't present yet (Phase 6 territory). This component renders an
 * "examples coming soon" empty state in that case rather than three blank chips.
 *
 * @param {Object} props
 * @param {Array}  props.examples       - the parsed examples.json array (or [])
 * @param {(ex: object) => void} props.onPick - clicked an example
 * @param {string} [props.activeId]     - currently active example id
 */
export default function ExampleChips({ examples, onPick, activeId }) {
  const hasExamples = Array.isArray(examples) && examples.length > 0

  return (
    <aside
      className="flex flex-col p-6"
      style={{
        border: '1px solid var(--color-line)',
        borderRadius: '4px',
      }}
    >
      <h3 className="mb-1 text-base font-semibold" style={{ color: 'var(--color-ink)' }}>
        Or try an example
      </h3>
      <p className="mb-6 text-[13px]" style={{ color: 'var(--color-dim)' }}>
        Pre-embedded outputs &mdash; click to load a report.
      </p>

      {!hasExamples ? (
        <div
          className="rounded-sm border border-dashed px-4 py-6 text-center font-mono text-[11px]"
          style={{
            borderColor: 'var(--color-line)',
            color: 'var(--color-faint)',
            letterSpacing: '0.04em',
          }}
        >
          examples coming soon
        </div>
      ) : (
        <div className="flex flex-col">
          {examples.map((ex) => {
            const active = activeId === ex.id
            const isUnique = String(ex.verdictHeadline || '').toLowerCase().includes('completely unique')
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => onPick?.(ex)}
                className="grid cursor-pointer items-center gap-3 border-t py-3.5 text-left transition-[padding-left]"
                style={{
                  gridTemplateColumns: '4px auto 1fr',
                  borderColor: 'var(--color-line)',
                  paddingLeft: active ? '4px' : 0,
                  background: 'transparent',
                }}
              >
                <span
                  className="block h-8 w-1 rounded-sm"
                  style={{
                    background: isUnique ? '#C9CABF' : 'var(--color-accent)',
                  }}
                />
                <span
                  className="whitespace-nowrap font-mono text-[12px] font-medium"
                  style={{
                    color: 'var(--color-ink)',
                    letterSpacing: '0.06em',
                  }}
                >
                  {ex.chipLabel ?? ex.id}
                </span>
                <span
                  className="text-right text-sm"
                  style={{ color: 'var(--color-dim)' }}
                >
                  {ex.title ?? ex.id}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </aside>
  )
}
