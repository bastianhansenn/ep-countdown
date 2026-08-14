import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The evening photo, pixel for pixel as a plain <img>, with the photographed
// lid cut from the same image trembling gently on top. The lid overlay tracks
// the object-cover crop across every window size. Constants must match the
// output of scripts/make-evening.mjs.
const IMG_W = 3600
const IMG_H = 2437
const LID = { x0: 0.4608, x1: 0.5408, y0: 0.327, y1: 0.393 }

export default function Stage({ onReady }: { onReady: () => void }) {
  const lidRef = useRef<HTMLImageElement | null>(null)
  const [layout, setLayout] = useState({ left: 0, top: 0, width: 0, height: 0 })
  const readyCount = useRef(0)
  const bump = () => {
    readyCount.current++
    if (readyCount.current === 2) onReady()
  }

  useLayoutEffect(() => {
    const compute = () => {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const scale = Math.max(vw / IMG_W, vh / IMG_H)
      const dw = IMG_W * scale
      const dh = IMG_H * scale
      const ox = (vw - dw) / 2
      const oy = (vh - dh) / 2
      setLayout({
        left: ox + LID.x0 * dw,
        top: oy + LID.y0 * dh,
        width: (LID.x1 - LID.x0) * dw,
        height: (LID.y1 - LID.y0) * dh,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  // A very mild rattle, as if the lid is about to lift: fractions of a pixel,
  // hinged at its base so the top trembles more than the rim, with a slow
  // swell-and-settle envelope so it never reads as a loop.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = () => {
      const el = lidRef.current
      if (el) {
        const t = performance.now() / 1000
        const amp = (0.55 + 0.45 * Math.sin(t * 0.7)) * (reduced ? 0.4 : 1)
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

  return (
    <div className="absolute inset-0 z-10 overflow-hidden">
      <img
        src="./background.jpg"
        alt=""
        className="h-full w-full object-cover"
        onLoad={bump}
        onError={bump}
      />
      <img
        ref={lidRef}
        src="./evening-lid.png"
        alt=""
        className="absolute will-change-transform"
        style={{
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
          transformOrigin: '50% 92%',
        }}
        onLoad={bump}
        onError={bump}
      />
    </div>
  )
}
