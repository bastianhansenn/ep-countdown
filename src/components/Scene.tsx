import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import Vase from './Vase'

// The professional night photo carries the real pedestal and the real
// street; the 3D vase is projected exactly onto the photographed vase so
// the rotation, vibrating lid, and inner glow live on top of it 1:1.
const BACKDROP_Z = -14
const IMG_ASPECT = 2400 / 1603

// Where the photographed vase sits in the image (fractions of the frame),
// tuned so the 3D vase fully covers the photographed one.
const VASE_U = 0.5068
const VASE_BASE_V = 0.655
const VASE_TOP_V = 0.315
const VASE_MODEL_H = 3.02 // model units from foot to the top of the finial

// Shared object-cover math: how the photo plane is sized at BACKDROP_Z.
function useCoverPlane() {
  const aspect = useThree((s) => s.viewport.aspect)
  const dist = 10 - BACKDROP_Z
  const frusH = 2 * dist * Math.tan((45 * Math.PI) / 360)
  const frusW = frusH * aspect
  const k = Math.max(frusW / IMG_ASPECT, frusH)
  return { planeW: IMG_ASPECT * k, planeH: k }
}

function Backdrop() {
  const texture = useTexture('./background-night.jpg')
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

// The 3D vase, aligned onto the photographed vase: same screen position and
// height regardless of window size, tracking the backdrop's cover crop.
function PhotoAlignedVase() {
  const { planeW, planeH } = useCoverPlane()
  const x = (VASE_U - 0.5) * planeW
  const yBase = (0.5 - VASE_BASE_V) * planeH
  const scale = ((VASE_BASE_V - VASE_TOP_V) * planeH) / VASE_MODEL_H
  return (
    <group position={[x, yBase, BACKDROP_Z + 0.3]} scale={scale}>
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
        <PhotoAlignedVase />
        <ReadyProbe onReady={onReady} />
        {/* Procedural environment map instead of an HDR preset: presets fetch
            from a CDN at runtime, and a failed fetch crashes the canvas tree.
            These panels render into a cube map once and give the glaze its
            reflections, fully offline. */}
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
