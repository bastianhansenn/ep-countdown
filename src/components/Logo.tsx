import { useState } from 'react'

// public/logo.png is the artist logo as a transparent PNG, so it composites
// directly with no blend tricks.
export default function Logo() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="flex items-center gap-3">
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
    </div>
  )
}
