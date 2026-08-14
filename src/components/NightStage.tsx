import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// The professional night photo, pixel-perfect as a plain <img> (no WebGL
// resampling), with the photographed lid cut from the same image vibrating
// on top and a soft pulsing glow at the lid seam. The lid overlay tracks the
// object-cover crop across every window size.
const IMG_W = 3600
const IMG_H = 2405
const LID = { x0: 0.458, x1: 0.555, y0: 0.322, y1: 0.398 }
const GLOW = { x: 0.5068, y: 0.389 }

export default function NightStage({ onReady }: { onReady: () => void }) {
  const lidRef = useRef<HTMLImageElement | null>(null)
  const [layout, setLayout] = useState({
    lidLeft: 0,
    lidTop: 0,
    lidWidth: 0,
    lidHeight: 0,
    glowX: 0,
    glowY: 0,
    glowSize: 0,
  })
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
        lidLeft: ox + LID.x0 * dw,
        lidTop: oy + LID.y0 * dh,
        lidWidth: (LID.x1 - LID.x0) * dw,
        lidHeight: (LID.y1 - LID.y0) * dh,
        glowX: ox + GLOW.x * dw,
        glowY: oy + GLOW.y * dh,
        glowSize: 0.085 * dh,
      })
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  // Lid vibration: the same incommensurate-frequency jitter the 3D lid had,
  // with a slow swell-and-settle envelope so it never reads as a loop.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const tick = () => {
      const el = lidRef.current
      if (el) {
        const t = performance.now() / 1000
        const amp = (0.6 + 0.4 * Math.sin(t * 0.8)) * (reduced ? 0.4 : 1)
        const unit = Math.max(1.4, window.innerHeight * 0.0022)
        const dy = amp * (Math.sin(t * 38) * 0.9 + Math.sin(t * 51 + 1.3) * 0.6) * unit
        const dx = amp * Math.sin(t * 47 + 0.7) * 0.45 * unit
        const rot = amp * Math.sin(t * 43) * 0.4
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
        src="./background-night.jpg"
        alt=""
        className="h-full w-full object-cover"
        onLoad={bump}
        onError={bump}
      />
      <div
        className="animate-seam-glow absolute mix-blend-screen"
        style={{
          left: layout.glowX - layout.glowSize / 2,
          top: layout.glowY - layout.glowSize / 4,
          width: layout.glowSize,
          height: layout.glowSize / 2,
          background:
            'radial-gradient(ellipse at center, rgba(77, 125, 255, 0.55) 0%, rgba(77, 125, 255, 0) 70%)',
          filter: 'blur(6px)',
        }}
      />
      <img
        ref={lidRef}
        src="./night-lid.png"
        alt=""
        className="absolute will-change-transform"
        style={{
          left: layout.lidLeft,
          top: layout.lidTop,
          width: layout.lidWidth,
          height: layout.lidHeight,
        }}
        onLoad={bump}
        onError={bump}
      />
    </div>
  )
}
