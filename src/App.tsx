import { useEffect, useState } from 'react'
import Countdown from './components/Countdown'
import Logo from './components/Logo'
import AudioPlayer from './components/AudioPlayer'
import UnlockButton from './components/UnlockButton'

// The page is just the photograph, the spinning logo and the countdown
// (hidden behind the unlock button). Everything reveals in ONE moment once
// the photo is loaded; a safety timer makes sure it can never hang black.
export default function App() {
  const [loaded, setLoaded] = useState(false)
  const [forced, setForced] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setForced(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const ready = forced || loaded

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden bg-[#030308] text-white transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <img
        src="./background.jpg"
        alt=""
        className="absolute inset-0 z-10 h-full w-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />

      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="mx-auto flex h-full max-w-7xl flex-col items-center justify-end px-6 pb-20 md:items-end md:justify-center md:pb-0 md:pr-16 lg:pr-24">
          <div
            className="flex flex-col items-center gap-10"
            style={{ textShadow: '0 1px 14px rgba(0, 0, 10, 0.65)' }}
          >
            <div className="flex min-h-24 items-center">
              {unlocked ? (
                <Countdown />
              ) : (
                <UnlockButton onUnlock={() => setUnlocked(true)} />
              )}
            </div>
            <Logo />
          </div>
        </div>
      </div>

      <AudioPlayer />
    </main>
  )
}
