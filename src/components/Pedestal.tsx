import { useMemo } from 'react'
import * as THREE from 'three'
import { sampleProfile } from '../lib/vaseProfiles'
import real from '../lib/realProfiles.json'

// The antique turned pedestal, traced 1:1 from the photo
// (scripts/trace-profiles.mjs): a square black top plate the vase stands on,
// and a turned baluster column with an urn bulge and a big ball, continuing
// below the frame. Model y = 0 is the vase foot on the plate top; the plate
// and column hang below.
// The photographed pedestal and plate were painted out of the backdrop with a
// small margin around them (their blur halo and contact shadow), so the 3D
// copies are built a little larger than the trace to cover every filled
// pixel. Verified by scripts/check-coverage.mjs; the difference is invisible
// because the original is no longer in the photo to compare against.
const PED_COVER = 1.3
const PLATE_COVER = 1.0

export default function Pedestal() {
  const columnGeometry = useMemo(() => {
    // pedestal points run top(plate bottom) -> down; reverse to increasing y
    // so the lathe surface normals face outward.
    const pts = (real.pedestal as [number, number][])
      .map(([hw, y]) => [hw * PED_COVER, y] as [number, number])
      .reverse()
    return new THREE.LatheGeometry(sampleProfile(pts, 128), 128)
  }, [])

  const { plate } = real.meta
  const plateTop = plate.topY + 0.03
  const plateBottom = plate.bottomY - 0.01
  const plateHalf = plate.half * PLATE_COVER
  const plateH = plateTop - plateBottom
  const plateMid = (plateTop + plateBottom) / 2

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
        <boxGeometry args={[plateHalf * 2, plateH, plateHalf * 1.2]} />
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
          color="#17151a"
          roughness={0.62}
          metalness={0}
          clearcoat={0.18}
          clearcoatRoughness={0.45}
          envMapIntensity={0.15}
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
