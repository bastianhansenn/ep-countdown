import { useState } from 'react'
import { motion } from 'framer-motion'

// public/logo.png is the artist logo as a transparent PNG, so it composites
// directly with no blend tricks.
export default function Logo() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay: 0.9 }}
    >
      <span className="text-2xl font-light text-white/50 select-none">-</span>
      <div className="[perspective:800px]">
        <div className="animate-spin-y [transform-style:preserve-3d]">
          {imgFailed ? (
            <span className="font-serif text-3xl tracking-widest text-white/50 italic select-none">
              S
            </span>
          ) : (
            <img
              src="./logo.png"
              alt="Artist logo"
              className="h-26 w-auto opacity-70"
              onError={() => setImgFailed(true)}
            />
          )}
        </div>
      </div>
    </motion.div>
  )
}
