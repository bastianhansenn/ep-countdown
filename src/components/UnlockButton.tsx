import { useState } from 'react'

// Stands where the countdown will appear. The click is also the user
// gesture that lets the audio start (AudioPlayer listens globally). A short
// exit beat before unmounting hands the stage to the countdown reveal.
export default function UnlockButton({ onUnlock }: { onUnlock: () => void }) {
  const [engaged, setEngaged] = useState(false)

  const handleClick = () => {
    if (engaged) return
    // Synchronous dispatch: AudioPlayer calls play() inside this very click,
    // which is what iOS requires before it allows sound.
    window.dispatchEvent(new CustomEvent('atte-request-audio'))
    setEngaged(true)
    setTimeout(onUnlock, 280)
  }

  return (
    <button
      onClick={handleClick}
      aria-label="Unlock countdown"
      className={`group pointer-events-auto flex items-center gap-3 rounded-full border border-white/20 bg-black/25 px-8 py-4 backdrop-blur-sm transition-all duration-300 hover:border-white/45 hover:bg-black/40 ${engaged ? 'scale-110 opacity-0 blur-sm' : 'opacity-100'}`}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4d7dff] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4d7dff] shadow-[0_0_10px_rgba(77,125,255,0.9)]" />
      </span>
      <span className="text-sm font-light tracking-[0.35em] text-white/85 uppercase transition-colors group-hover:text-white">
        Unlock Countdown
      </span>
    </button>
  )
}
