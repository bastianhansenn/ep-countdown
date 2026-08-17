import { useMemo } from 'react'
import * as THREE from 'three'
import { sampleProfile } from '../lib/vaseProfiles'
import real from '../lib/realProfiles.json'

// The antique turned pedestal, traced 1:1 from the photo
// (scripts/trace-profiles.mjs): a square black top plate the vase stands on,
// and a turned baluster column with an urn bulge and a big ball, continuing
// below the frame. Model y = 0 is the vase foot on the plate top; the plate
// and column hang below.
export default function Pedestal() {
  const columnGeometry = useMemo(() => {
    // pedestal points run top(plate bottom) -> down; reverse to increasing y
    // so the lathe surface normals face outward.
    const pts = (real.pedestal as [number, number][]).slice().reverse()
    return new THREE.LatheGeometry(sampleProfile(pts, 128), 128)
  }, [])

  const { plate } = real.meta
  const plateH = plate.topY - plate.bottomY
  const plateMid = (plate.topY + plate.bottomY) / 2

  // Soft contact shadow grounding the stand on the cobbles.
  const shadowTexture = useMemo(() => {
    const size = 256
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5)
    g.addColorStop(0, 'rgba(0,0,8,0.75)')
    g.addColorStop(0.55, 'rgba(0,0,8,0.4)')
    g.addColorStop(1, 'rgba(0,0,8,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  return (
    <group>
      {/* Square black top plate. */}
      <mesh position={[0, plateMid, 0]}>
        <boxGeometry args={[plate.half * 2, plateH, plate.half * 2]} />
        <meshPhysicalMaterial
          color="#141216"
          roughness={0.45}
          metalness={0}
          clearcoat={0.35}
          clearcoatRoughness={0.35}
          envMapIntensity={0.4}
        />
      </mesh>
      {/* Turned baluster column with the ball. */}
      <mesh geometry={columnGeometry}>
        <meshPhysicalMaterial
          color="#0f0d11"
          roughness={0.4}
          metalness={0}
          clearcoat={0.5}
          clearcoatRoughness={0.28}
          envMapIntensity={0.5}
        />
      </mesh>
      {/* Contact shadow near the frame bottom. */}
      <mesh
        position={[0, real.pedestal[real.pedestal.length - 1][1] + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}
