import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import Pedestal from './Pedestal'
import Vase from './Vase'

// The street photo lives INSIDE the WebGL scene as well as in the DOM, so the
// vase is lit and composited against the same image. Sized like CSS
// object-cover against the camera frustum at its depth. Must match
// public/background.jpg.
const BACKDROP_Z = -14
const IMG_ASPECT = 3600 / 2405

// Where the photographed vase sits (fractions of the frame), from
// scripts/trace-profiles.mjs, so the 3D copy lands exactly on it.
const VASE_U = 0.5067
const VASE_BASE_V = 0.649 // foot (model y = 0)
const VASE_TOP_V = 0.325 // finial top (model y = MODEL_H)
const VASE_MODEL_H = 3.02
// The photographed vase was painted out of the backdrop with a small margin
// (its blur halo), so the 3D copy is placed a few percent larger to cover
// every filled pixel. Verified by scripts/check-coverage.mjs.
const COVER_SCALE = 1.07

// How far into the evening the scene is: 0 = the daylight photo, 1 = full
// evening. scripts/make-background.mjs grades the backdrop with the SAME
// number (node scripts/make-background.mjs <EVENING>), so the vase's light and
// the street always match. Everything below interpolates from it.
const EVENING = 0.8
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const mixHex = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0')
  return `#${h(mix(ar, br, t))}${h(mix(ag, bg, t))}${h(mix(ab, bb, t))}`
}
const LIGHT = {
  ambient: mix(0.85, 0.3, EVENING),
  ambientColor: mixHex('#dfe3e6', '#93a3bd', EVENING),
  key: mix(0.55, 0.14, EVENING),
  keyColor: mixHex('#f0f2f4', '#aebbd2', EVENING),
  rimBlue: mix(0.05, 0.3, EVENING),
  rimViolet: mix(0.03, 0.16, EVENING),
  beam: mix(0.5, 0.85, EVENING),
  env: mix(1.6, 0.5, EVENING),
  envFill: mix(1.1, 0.35, EVENING),
  envWarm: mix(0.7, 0.22, EVENING),
  envRoom: mixHex('#15161a', '#05060a', EVENING),
}

// Shared object-cover math: the photo plane size at BACKDROP_Z.
function useCoverPlane() {
  const aspect = useThree((s) => s.viewport.aspect)
  const dist = 10 - BACKDROP_Z
  const frusH = 2 * dist * Math.tan((45 * Math.PI) / 360)
  const frusW = frusH * aspect
  const k = Math.max(frusW / IMG_ASPECT, frusH)
  return { planeW: IMG_ASPECT * k, planeH: k }
}

function Backdrop() {
  const texture = useTexture('./background.jpg')
  const { planeW, planeH } = useCoverPlane()
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])
  return (
    <mesh position={[0, 0, BACKDROP_Z]}>
      <planeGeometry args={[planeW, planeH]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

// Mounts only after the suspended textures resolve; fires after the second
// frame, i.e. once the first real draw (including shader compilation) is on
// screen. That is the page's "everything is ready" signal.
function ReadyProbe({ onReady }: { onReady: () => void }) {
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    if (frames.current === 2) onReady()
  })
  return null
}

// The ensemble is projected 1:1 onto the photographed vase: local y = 0 (the
// vase foot) lands at VASE_BASE_V and the finial top at VASE_TOP_V, at the
// same screen position and size regardless of window aspect, tracking the
// backdrop's object-cover crop.
function MuseumDisplay() {
  const { planeW, planeH } = useCoverPlane()
  const spotTarget = useMemo(() => new THREE.Object3D(), [])
  const x = (VASE_U - 0.5) * planeW
  const yFoot = (0.5 - VASE_BASE_V) * planeH
  const scale = (((VASE_BASE_V - VASE_TOP_V) * planeH) / VASE_MODEL_H) * COVER_SCALE

  return (
    <group position={[x, yFoot, BACKDROP_Z + 0.3]} scale={scale}>
      {/* Cool overhead beam, like a night-lit museum piece. */}
      <spotLight
        position={[1.5, 7.5, 3]}
        target={spotTarget}
        color="#d8e4ff"
        intensity={LIGHT.beam}
        angle={0.42}
        penumbra={0.9}
        decay={0}
      />
      <primitive object={spotTarget} position={[0, 0.8, 0]} />
      <Pedestal />
      <Vase />
    </group>
  )
}

export default function Scene({ onReady }: { onReady: () => void }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      dpr={2}
    >
      {/* No fog: it would wash out the in-scene photo backdrop, and the
          baked depth-of-field in the image already carries the depth cue. */}
      {/* Lit to match the photo: an overcast, slightly cool sky, soft and
          low-contrast. A bright key would blow the glaze into plastic blue. */}
      <ambientLight intensity={LIGHT.ambient} color={LIGHT.ambientColor} />
      <directionalLight position={[4, 6, 5]} intensity={LIGHT.key} color={LIGHT.keyColor} />
      {/* decay 0 = no physical falloff; these are distant rim accents. */}
      <pointLight position={[-5, 2, -3]} color="#3355ff" intensity={LIGHT.rimBlue} decay={0} />
      <pointLight position={[4, -1, -4]} color="#7744cc" intensity={LIGHT.rimViolet} decay={0} />

      {/* Separate boundaries: the vase must not wait for the backdrop's
          bigger download, and vice versa. Preload links in index.html warm
          all of these in parallel with the JS bundle. */}
      <Suspense fallback={null}>
        <Backdrop />
      </Suspense>
      <Suspense fallback={null}>
        <MuseumDisplay />
        <ReadyProbe onReady={onReady} />
        {/* Procedural environment map instead of an HDR preset: presets fetch
            from a CDN at runtime, and a failed fetch crashes the canvas tree.
            These panels render into a cube map once and give the glaze its
            reflections, fully offline. */}
        <Environment resolution={256} frames={1}>
          <mesh scale={100}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={LIGHT.envRoom} side={THREE.BackSide} />
          </mesh>
          <Lightformer
            intensity={LIGHT.env}
            color="#eef1f4"
            position={[5, 5, 5]}
            scale={[6, 6, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            intensity={LIGHT.envFill}
            color="#c9cdd3"
            position={[-6, 2, -4]}
            scale={[8, 4, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            intensity={LIGHT.envWarm}
            color="#bcbfc4"
            position={[6, -2, -5]}
            scale={[6, 3, 1]}
            target={[0, 0, 0]}
          />
        </Environment>
      </Suspense>
    </Canvas>
  )
}
