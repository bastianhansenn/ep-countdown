import { useEffect, useState } from 'react'

// The invitation above the countdown. Its real job is to give the browser
// the user gesture it demands before audio may play: any click starts the
// loop (AudioPlayer listens globally), and once the music actually runs the
// button thanks and bows out.
export default function ListenButton() {
  const [engaged, setEngaged] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const onPlaying = () => {
      setEngaged(true)
      const t = setTimeout(() => setGone(true), 900)
      return () => clearTimeout(t)
    }
    window.addEventListener('atte-audio-playing', onPlaying)
    return () => window.removeEventListener('atte-audio-playing', onPlaying)
  }, [])

  if (gone) return null

  return (
    <button
      className={`group pointer-events-auto flex items-center gap-3 rounded-full border border-white/20 bg-black/25 px-7 py-3 backdrop-blur-sm transition-all duration-700 hover:border-white/45 hover:bg-black/40 ${engaged ? 'scale-95 opacity-0' : 'opacity-100'}`}
      aria-label="Åbn vasen og hør lyden"
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4d7dff] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4d7dff] shadow-[0_0_10px_rgba(77,125,255,0.9)]" />
      </span>
      <span className="text-sm font-light tracking-[0.35em] text-white/85 uppercase transition-colors group-hover:text-white">
        Åbn vasen
      </span>
    </button>
  )
}
