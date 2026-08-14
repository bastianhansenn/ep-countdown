import { useEffect, useRef } from 'react'

// The evening photo with the lid trembling gently on top.
//
// Alignment strategy: the photo and the lid live inside ONE wrapper whose
// size is the object-cover rect computed in pure CSS (see .stage-cover), so
// they can never drift apart (JS innerHeight and CSS dvh disagree on phones
// whenever the address bar collapses, which offset the old sprite).
//
// Rendering strategy: the lid is NOT a separate bitmap but a WINDOW into the
// same background.jpg (background-size/-position), so at rest the browser
// samples the identical image at the identical scale: pixel-for-pixel
// invisible on every device. evening-lid.png only supplies the feathered
// alpha mask. Constants must match scripts/make-evening.mjs.
const LID = { x0: 0.4608, x1: 0.5408, y0: 0.327, y1: 0.393 }
const LID_W = LID.x1 - LID.x0
const LID_H = LID.y1 - LID.y0
const pct = (v: number) => `${(v * 100).toFixed(4)}%`

export default function Stage({ onReady }: { onReady: () => void }) {
  const lidRef = useRef<HTMLDivElement | null>(null)

  // A mild constant rattle, as if the lid is about to lift: fractions of a
  // pixel, hinged at its base so the top trembles more than the rim. The
  // envelope only breathes a little, so the lid NEVER stands still.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = () => {
      const el = lidRef.current
      if (el) {
        const t = performance.now() / 1000
        const amp = (0.85 + 0.15 * Math.sin(t * 0.7)) * (reduced ? 0.4 : 1)
        const unit = Math.max(0.4, window.innerHeight * 0.0005)
        const dy = amp * (Math.sin(t * 34) * 0.7 + Math.sin(t * 47 + 1.3) * 0.4) * unit
        const dx = amp * Math.sin(t * 41 + 0.7) * 0.25 * unit
        const rot = amp * Math.sin(t * 39) * 0.1
        el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const maskStyle = {
    maskImage: "url('./evening-lid.png')",
    maskSize: '100% 100%',
    WebkitMaskImage: "url('./evening-lid.png')",
    WebkitMaskSize: '100% 100%',
  } as const

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <div className="stage-cover">
        <img
          src="./background.jpg"
          alt=""
          className="h-full w-full"
          onLoad={onReady}
          onError={onReady}
        />
        <div
          ref={lidRef}
          className="absolute will-change-transform"
          style={{
            left: pct(LID.x0),
            top: pct(LID.y0),
            width: pct(LID_W),
            height: pct(LID_H),
            backgroundImage: "url('./background.jpg')",
            backgroundSize: `${(100 / LID_W).toFixed(4)}% ${(100 / LID_H).toFixed(4)}%`,
            backgroundPosition: `${((LID.x0 / (1 - LID_W)) * 100).toFixed(4)}% ${((LID.y0 / (1 - LID_H)) * 100).toFixed(4)}%`,
            transformOrigin: '50% 92%',
            ...maskStyle,
          }}
        />
      </div>
    </div>
  )
}
