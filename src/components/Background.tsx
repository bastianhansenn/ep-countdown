import { useState } from 'react'

// public/background.jpg is the professional street photo (scripts/
// make-background.mjs), shown as-is: no CSS grading on top. If the file is
// missing, the gradient layers below stand alone as an intentional dark
// backdrop.
export default function Background() {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="fixed inset-0 z-0 bg-[#030308]">
      {!imgFailed && (
        <img
          src="./background.jpg"
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      )}
      {imgFailed && (
        <div className="absolute inset-0 bg-linear-to-b from-[#0a1230]/60 via-transparent to-[#050510]/80" />
      )}
    </div>
  )
}
