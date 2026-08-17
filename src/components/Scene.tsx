import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import Pedestal from './Pedestal'
import Vase from './Vase'
import GlassCase from './GlassCase'

// The night photo lives INSIDE the WebGL scene (not only in the DOM), so the
// transmissive glass can refract it. Sized like CSS object-cover against the
// camera frustum at its depth.
const BACKDROP_Z = -14
const IMG_ASPECT = 1920 / 1148

function Backdrop() {
  const texture = useTexture('./background-night.jpg')
  const aspect = useThree((s) => s.viewport.aspect)
  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])

  const dist = 10 - BACKDROP_Z
  const frusH = 2 * dist * Math.tan((45 * Math.PI) / 360)
  const frusW = frusH * aspect
  const k = Math.max(frusW / IMG_ASPECT, frusH)
  return (
    <mesh position={[0, 0, BACKDROP_Z]}>
      <planeGeometry args={[IMG_ASPECT * k, k]} />
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

// Group origin sits at the pedestal top: the vase stands at local y = 0 and
// the pedestal extends downward. Pushed back down the street; with a level
// camera the ground plane keeps the same world y at any depth, so it still
// stands on the cobblestones.
function MuseumDisplay() {
  const viewportWidth = useThree((s) => s.viewport.width)
  const isMobile = viewportWidth < 7
  const spotTarget = useMemo(() => new THREE.Object3D(), [])

  return (
    <group
      position={isMobile ? [0, -0.06, -3] : [-2.2, 0.73, -3.5]}
      scale={isMobile ? 0.95 : 1.12}
    >
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
