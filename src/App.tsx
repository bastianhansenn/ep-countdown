import { useEffect, useState } from 'react'
import Stage from './components/Stage'
import Countdown from './components/Countdown'
import Logo from './components/Logo'
import AudioPlayer from './components/AudioPlayer'
import UnlockButton from './components/UnlockButton'

// The page is the evening photograph, the spinning logo and the countdown
// (hidden behind the unlock button). Everything reveals in ONE moment once
// the photo and lid are loaded; a safety timer makes sure it can never hang
// black. Mobile puts the countdown in the sky and the logo on the black ball
// at the base of the pedestal; desktop keeps the stack beside the vase.
export default function App() {
  const [stageReady, setStageReady] = useState(false)
  const [forced, setForced] = useState(false)
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setForced(true), 2500)
    return () => clearTimeout(t)
  }, [])

  const ready = forced || stageReady

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden bg-[#030308] text-white transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <Stage onReady={() => setStageReady(true)} />

      <div
        className="pointer-events-none absolute inset-0 z-30"
        style={{ textShadow: '0 1px 14px rgba(0, 0, 10, 0.65)' }}
      >
        <div className="md:hidden">
          <div className="absolute inset-x-0 top-[13%] flex justify-center px-4">
            {unlocked ? (
              <Countdown />
            ) : (
              <UnlockButton onUnlock={() => setUnlocked(true)} />
            )}
          </div>
          <div className="absolute inset-x-0 top-[90%] flex -translate-y-1/2 justify-center">
            <Logo />
          </div>
        </div>

        <div className="hidden h-full md:block">
          <div className="mx-auto flex h-full max-w-7xl flex-col items-end justify-center pr-16 lg:pr-24">
            <div className="flex flex-col items-center gap-10">
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
      </div>

      <AudioPlayer />
    </main>
  )
}
