import { useMemo } from 'react'
import * as THREE from 'three'

// Modeled after the vidaXL display stand (black oak, 31 x 30 x 60 cm,
// engineered wood): a slender rectangular column with a slightly
// overhanging flat top plate and matching base plate, vertical grain.
// Group origin sits at the top of the stand.

function makeBlackOakTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#131110'
  ctx.fillRect(0, 0, W, H)

  // Broad tonal bands.
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * W
    const w = 30 + Math.random() * 60
    ctx.fillStyle = i % 2 === 0 ? 'rgba(58, 48, 36, 0.05)' : 'rgba(5, 4, 3, 0.07)'
    ctx.fillRect(x - w / 2, 0, w, H)
  }

  // Vertical wavy grain lines.
  for (let i = 0; i < 150; i++) {
    const x0 = Math.random() * W
    const light = Math.random() < 0.5
    ctx.strokeStyle = light
      ? `rgba(64, 53, 40, ${0.05 + Math.random() * 0.08})`
      : `rgba(6, 5, 4, ${0.07 + Math.random() * 0.09})`
    ctx.lineWidth = 0.8 + Math.random() * 2.2
    ctx.beginPath()
    ctx.moveTo(x0, 0)
    let x = x0
    for (let y = 0; y <= H; y += 64) {
      x += (Math.random() - 0.5) * 10
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export default function Pedestal() {
  const oak = useMemo(() => {
    const map = makeBlackOakTexture()
    return new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.5,
    })
  }, [])

  // Soft radial contact shadow that grounds the stand on the cobblestones.
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
      <mesh material={oak} position={[0, -0.06, 0]}>
        <boxGeometry args={[1.85, 0.12, 1.8]} />
      </mesh>
      <mesh material={oak} position={[0, -1.66, 0]}>
        <boxGeometry args={[1.7, 3.08, 1.65]} />
      </mesh>
      <mesh material={oak} position={[0, -3.25, 0]}>
        <boxGeometry args={[1.85, 0.1, 1.8]} />
      </mesh>
      <mesh position={[0, -3.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
