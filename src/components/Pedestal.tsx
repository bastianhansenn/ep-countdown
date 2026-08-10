import { useMemo } from 'react'
import * as THREE from 'three'

// Antique turned-wood pedestal modeled after the reference photos: square
// top plate, trumpet capital, large ball, slender tapered shaft, ringed
// bulb at the bottom, square base plate on small feet. Ebonized black with
// a worn, more matte top. Total height 3.30; top of the plate at local y=0.
const TURNED_PROFILE: [number, number][] = [
  [0.2, 0.0],
  [0.27, 0.03],
  [0.29, 0.07],
  [0.26, 0.11],
  [0.28, 0.15],
  [0.24, 0.19],
  [0.21, 0.22],
  [0.215, 0.25],
  [0.165, 2.0],
  [0.165, 2.02],
  [0.21, 2.05],
  [0.22, 2.09],
  [0.17, 2.12],
  [0.26, 2.2],
  [0.29, 2.32],
  [0.26, 2.45],
  [0.18, 2.54],
  [0.2, 2.57],
  [0.23, 2.6],
  [0.19, 2.63],
  [0.17, 2.66],
  [0.2, 2.8],
  [0.3, 2.92],
  [0.4, 2.99],
  [0.42, 3.02],
]

export default function Pedestal() {
  const turnedGeometry = useMemo(() => {
    const curve = new THREE.SplineCurve(
      TURNED_PROFILE.map(([x, y]) => new THREE.Vector2(x, y)),
    )
    return new THREE.LatheGeometry(curve.getSpacedPoints(96), 64)
  }, [])

  const ebony = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#0b0b0e',
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
        envMapIntensity: 0.55,
      }),
    [],
  )
  const wornTop = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#17171a',
        roughness: 0.65,
        metalness: 0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.5,
        envMapIntensity: 0.35,
      }),
    [],
  )

  // Soft radial contact shadow that grounds the pedestal on the cobbles.
  const shadowTexture = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const grad = ctx.createRadialGradient(
      size / 2, size / 2, size * 0.1,
      size / 2, size / 2, size * 0.5,
    )
    grad.addColorStop(0, 'rgba(0, 0, 8, 0.8)')
    grad.addColorStop(0.55, 'rgba(0, 0, 8, 0.45)')
    grad.addColorStop(1, 'rgba(0, 0, 8, 0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [])

  return (
    <group>
      {/* Worn square top plate. */}
      <mesh material={wornTop} position={[0, -0.05, 0]}>
        <boxGeometry args={[1.15, 0.1, 1.15]} />
      </mesh>

      {/* The turned column: capital, ball, shaft, bottom rings. */}
      <mesh material={ebony} geometry={turnedGeometry} position={[0, -3.12, 0]} />

      {/* Base plate and four small feet. */}
      <mesh material={ebony} position={[0, -3.18, 0]}>
        <boxGeometry args={[1.15, 0.12, 1.15]} />
      </mesh>
      {[
        [-0.46, -0.46],
        [0.46, -0.46],
        [-0.46, 0.46],
        [0.46, 0.46],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} material={ebony} position={[x, -3.27, z]}>
          <cylinderGeometry args={[0.07, 0.06, 0.06, 12]} />
        </mesh>
      ))}

      <mesh position={[0, -3.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 3.4]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </mesh>
    </group>
  )
}
