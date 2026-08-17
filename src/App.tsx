import { useEffect, useState } from 'react'
import Background from './components/Background'
import Scene from './components/Scene'
import Countdown from './components/Countdown'
import Logo from './components/Logo'
import AudioPlayer from './components/AudioPlayer'
import UnlockButton from './components/UnlockButton'

// The whole page reveals in ONE moment: everything stays hidden until the 3D
// scene has drawn its first real frame (textures loaded, shaders compiled)
// and the backdrop photo is decoded. A safety timer force-reveals so the page
// can never hang black.
export default function App() {
  const [sceneReady, setSceneReady] = useState(false)
  const [bgReady, setBgReady] = useState(false)
  const [forced, setForced] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setForced(true), 2500)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const img = new Image()
    img.src = './background.jpg'
    img
      .decode()
      .then(() => setBgReady(true))
      .catch(() => setBgReady(true))
  }, [])

  const ready = forced || (sceneReady && bgReady)
  const [unlocked, setUnlocked] = useState(false)

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden text-white transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <Background />

      <div className="absolute inset-0 z-10">
        <Scene onReady={() => setSceneReady(true)} />
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 62%, rgba(0, 0, 5, 0.4) 100%)',
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="mx-auto flex h-full max-w-7xl flex-col items-center justify-end px-6 pb-20 md:items-end md:justify-center md:pb-0 md:pr-16 lg:pr-24">
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

      <AudioPlayer />
    </main>
  )
}
