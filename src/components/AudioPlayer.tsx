import { useEffect, useRef, useState } from 'react'

// Looping site audio via Web Audio: the whole track is decoded to a buffer
// and looped sample-accurately (no gap at the seam, unlike <audio loop>).
// Browsers refuse sound before a user gesture, so: try immediately (allowed
// for returning visitors), otherwise start on the first pointer/key input
// anywhere. The speaker button toggles mute and is itself a valid gesture.
export default function AudioPlayer() {
  const [muted, setMuted] = useState(
    () => localStorage.getItem('atte-muted') === '1',
  )
  const [playing, setPlaying] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const startRef = useRef<() => void>(() => {})

  useEffect(() => {
    let disposed = false
    let started = false
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    ctxRef.current = ctx
    gainRef.current = gain

    // Fetch and decode eagerly so the first gesture gives instant sound.
    const bufferPromise = fetch('./intro.m4a')
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .catch(() => null)

    const start = async () => {
      if (started || disposed) return
      const buffer = await bufferPromise
      if (!buffer || started || disposed) return
      started = true
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      src.connect(gain)
      src.start()
      setPlaying(true)
    }
    startRef.current = () => {
      ctx.resume().then(start).catch(() => {})
    }

    // Attempt autoplay; if the context is suspended, arm one-time listeners
    // for the first interaction anywhere on the page.
    ctx.resume().then(() => {
      if (ctx.state === 'running') start()
    }).catch(() => {})

    const onInteract = () => {
      ctx.resume().then(start).catch(() => {})
    }
    window.addEventListener('pointerdown', onInteract)
    window.addEventListener('keydown', onInteract)
    ctx.addEventListener('statechange', onInteract)

    return () => {
      disposed = true
      window.removeEventListener('pointerdown', onInteract)
      window.removeEventListener('keydown', onInteract)
      ctx.removeEventListener('statechange', onInteract)
      ctx.close().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const gain = gainRef.current
    const ctx = ctxRef.current
    if (gain && ctx) {
      gain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05)
    }
    localStorage.setItem('atte-muted', muted ? '1' : '0')
  }, [muted])

  const toggle = () => {
    startRef.current()
    setMuted((m) => !m)
  }

  const showAsOn = playing && !muted

  return (
    <button
      onClick={toggle}
      aria-label={showAsOn ? 'Sluk lyd' : 'Taend lyd'}
      className="pointer-events-auto fixed right-5 bottom-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/60 backdrop-blur-sm transition-colors hover:text-white"
    >
      {showAsOn ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </svg>
      )}
    </button>
  )
}
