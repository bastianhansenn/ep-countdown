import { useEffect, useRef, useState } from 'react'

// Site audio through an <audio> element rather than pure Web Audio: on iOS
// an element play() inside a gesture is the only reliable unlock, and media
// element playback ignores the physical silent switch (Web Audio does not).
// The track loops natively; play is attempted immediately (returning
// visitors) and otherwise started by the first gesture anywhere.
export default function AudioPlayer() {
  const [muted, setMuted] = useState(
    () => localStorage.getItem('atte-muted') === '1',
  )
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = new Audio('./intro.m4a')
    el.loop = true
    el.preload = 'auto'
    audioRef.current = el

    let disposed = false
    const tryPlay = () => {
      el.play()
        .then(() => {
          if (disposed) return
          setPlaying(true)
          window.dispatchEvent(new CustomEvent('atte-audio-playing'))
          removeListeners()
        })
        .catch(() => {})
    }
    const removeListeners = () => {
      window.removeEventListener('pointerdown', tryPlay)
      window.removeEventListener('touchend', tryPlay)
      window.removeEventListener('click', tryPlay)
      window.removeEventListener('keydown', tryPlay)
    }

    tryPlay()
    window.addEventListener('pointerdown', tryPlay)
    window.addEventListener('touchend', tryPlay)
    window.addEventListener('click', tryPlay)
    window.addEventListener('keydown', tryPlay)
    window.addEventListener('atte-request-audio', tryPlay)

    return () => {
      disposed = true
      removeListeners()
      window.removeEventListener('atte-request-audio', tryPlay)
      el.pause()
      el.src = ''
    }
  }, [])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
    localStorage.setItem('atte-muted', muted ? '1' : '0')
  }, [muted])

  const toggle = () => {
    const el = audioRef.current
    if (el && el.paused) {
      el.play().then(() => {
        setPlaying(true)
        window.dispatchEvent(new CustomEvent('atte-audio-playing'))
      }).catch(() => {})
    }
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
