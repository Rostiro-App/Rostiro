// Every marketing/Features surface that needs "show, don't tell" points
// here instead of a static screenshot. Glass-heavy frame plus a subtle
// breathing signal glow (reuses .breathe, the same idle-pulse the System
// Bar's sync dot uses; no new animation invented just for marketing).
//
// `caption` is user-facing (shown under the frame). `recordingNote` is
// intentionally never rendered. It's the founder's own shot list, read
// from the source, not the page. `src` is optional: omitted while a slot
// is still waiting on real footage (renders the "Demo coming soon"
// placeholder), provided once a real file exists at public/videos/.

interface ProductVideoDemoProps {
  caption: string
  // Never rendered. The founder's own shot list for this exact clip, kept
  // next to the component that will eventually show it rather than in a
  // separate doc that drifts out of sync with where each demo actually lives.
  recordingNote: string
  src?: string
}

export default function ProductVideoDemo({ caption, src }: ProductVideoDemoProps) {
  return (
    <div>
      <div
        className="glass-heavy rounded-2xl overflow-hidden relative"
        style={{ aspectRatio: '16 / 9', border: '1px solid var(--hairline-bright)' }}
      >
        {src ? (
          <video src={src} autoPlay loop muted playsInline className="w-full h-full object-cover" />
        ) : (
          <>
            <div
              className="breathe absolute inset-0"
              style={{ boxShadow: 'inset 0 0 60px rgba(75,163,245,0.14)' }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--signal-dim)', border: '1px solid rgba(75,163,245,.4)' }}
              >
                <span style={{ color: 'var(--signal)', fontSize: 20, marginLeft: 3 }}>▶</span>
              </div>
              <span className="mono-data text-[10px] tracking-[0.16em] uppercase" style={{ color: 'var(--t4)' }}>
                Demo coming soon
              </span>
            </div>
          </>
        )}
      </div>
      <p className="text-sm mt-3 text-center" style={{ color: 'var(--t3)' }}>{caption}</p>
    </div>
  )
}
