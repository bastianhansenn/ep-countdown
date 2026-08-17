import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import Pedestal from './Pedestal'
import Vase from './Vase'
import GlassCase from './GlassCase'

// The street photo lives INSIDE the WebGL scene (not only in the DOM), so the
// transmissive glass can refract it. Sized like CSS object-cover against the
// camera frustum at its depth. Must match public/background.jpg.
const BACKDROP_Z = -14
const IMG_ASPECT = 3600 / 2405

// Where the photographed vase sits (fractions of the frame), from
// scripts/trace-profiles.mjs, so the 3D copy lands exactly on it.
const VASE_U = 0.5067
const VASE_BASE_V = 0.649 // foot (model y = 0)
const VASE_TOP_V = 0.325 // finial top (model y = MODEL_H)
const VASE_MODEL_H = 3.02

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
  const scale = ((VASE_BASE_V - VASE_TOP_V) * planeH) / VASE_MODEL_H

  return (
    <group position={[x, yFoot, BACKDROP_Z + 0.3]} scale={scale}>
      {/* Cool overhead beam, like a night-lit museum piece. */}
      <spotLight
        position={[1.5, 7.5, 3]}
        target={spotTarget}
        color="#d8e4ff"
        intensity={1.8}
        angle={0.42}
        penumbra={0.8}
        decay={0}
      />
      <primitive object={spotTarget} position={[0, 0.8, 0]} />
      <Pedestal />
      <Vase />
      <GlassCase />
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
      <ambientLight intensity={0.22} />
      <directionalLight position={[4, 6, 5]} intensity={1.1} color="#ffffff" />
      {/* decay 0 = no physical falloff; these are distant rim accents. */}
      <pointLight position={[-5, 2, -3]} color="#3355ff" intensity={0.8} decay={0} />
      <pointLight position={[4, -1, -4]} color="#7744cc" intensity={0.4} decay={0} />

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
            These panels render into a cube map once and give the glass and
            glaze their reflections, fully offline. */}
        <Environment resolution={256} frames={1}>
          <mesh scale={100}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#05050f" side={THREE.BackSide} />
          </mesh>
          <Lightformer
            intensity={2}
            color="#cfe0ff"
            position={[5, 5, 5]}
            scale={[6, 6, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            intensity={3}
            color="#3a5cff"
            position={[-6, 2, -4]}
            scale={[8, 4, 1]}
            target={[0, 0, 0]}
          />
          <Lightformer
            intensity={1.5}
            color="#7744cc"
            position={[6, -2, -5]}
            scale={[6, 3, 1]}
            target={[0, 0, 0]}
          />
        </Environment>
      </Suspense>
    </Canvas>
  )
}
