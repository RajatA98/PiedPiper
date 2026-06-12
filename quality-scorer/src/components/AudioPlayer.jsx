import { useEffect, useRef, useState } from 'react'
import { fmtDuration } from '../lib/format.js'

// Transport UI. Playback is simulated in this prototype (no audio stream is bundled);
// the data shape leaves room for a real <audio> source when the backend lands.
export default function AudioPlayer({ durationSec = 180 }) {
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const raf = useRef()
  const last = useRef(null)

  useEffect(() => {
    if (!playing) return
    const tick = (ts) => {
      if (last.current != null) {
        const dt = (ts - last.current) / 1000
        setPos((p) => {
          const next = p + dt * 4 // 4× so the demo moves along
          if (next >= durationSec) {
            setPlaying(false)
            return 0
          }
          return next
        })
      }
      last.current = ts
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf.current)
      last.current = null
    }
  }, [playing, durationSec])

  const pct = Math.min(100, (pos / durationSec) * 100)

  return (
    <div className="flex items-center gap-3" title="Playback is simulated in this prototype">
      <button
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-elev text-ink transition-colors hover:border-accent hover:text-accent"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2" y="1.5" width="3" height="9" fill="currentColor" />
            <rect x="7" y="1.5" width="3" height="9" fill="currentColor" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 1.5l8 4.5-8 4.5z" fill="currentColor" />
          </svg>
        )}
      </button>
      <div className="relative h-1 flex-1 bg-line">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-faint">
        {fmtDuration(pos)} / {fmtDuration(durationSec)}
      </span>
    </div>
  )
}
