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

  // The lid LIFTS gently instead of vibrating: it rises a few pixels, hovers
  // with the faintest sway, and settles again, breathing on a slow cycle.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const smooth = (a: number, b: number, x: number) => {
      const s = Math.max(0, Math.min(1, (x - a) / (b - a)))
      return s * s * (3 - 2 * s)
    }
    let raf = 0
    const tick = () => {
      const el = lidRef.current
      if (el) {
        const t = performance.now() / 1000
        const cycle = (t % 5.6) / 5.6
        // rest, rise (~1.3s), hover (~1.1s), settle (~1.7s), rest
        const rise = smooth(0.08, 0.32, cycle) * (1 - smooth(0.52, 0.82, cycle))
        const liftPx = Math.max(2, window.innerHeight * 0.0032)
        const dy = -rise * liftPx * (reduced ? 0.4 : 1)
        const rot = rise * 0.3 * Math.sin(t * 1.9)
        el.style.transform = `translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`
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
