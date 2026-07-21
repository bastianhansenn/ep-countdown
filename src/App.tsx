import { motion } from 'framer-motion'
import Background from './components/Background'
import Scene from './components/Scene'
import Countdown from './components/Countdown'
import Logo from './components/Logo'

export default function App() {
  return (
    <main className="relative h-dvh w-full overflow-hidden text-white">
      <Background />

      <motion.div
        className="absolute inset-0 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        <Scene />
      </motion.div>

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
            <Countdown />
            <Logo />
          </div>
        </div>
      </div>
    </main>
  )
}
