import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { sampleProfile } from '../lib/vaseProfiles'
import real from '../lib/realProfiles.json'

// Body/lid silhouettes traced 1:1 from the photographed vase
// (scripts/trace-profiles.mjs). The lid rides 0.01 above the neck rim,
// leaving a thin seam gap for the glow.
const BODY_PROFILE = real.body as [number, number][]
const LID_PROFILE = real.lid as [number, number][]
const NECK_HALF = BODY_PROFILE[BODY_PROFILE.length - 1][0]
const LID_BASE_Y = real.meta.seamY + 0.01
const FIN = real.meta.finial

export default function Vase() {
  const gl = useThree((s) => s.gl)

  const vaseGroup = useRef<THREE.Group>(null!)
  const lid = useRef<THREE.Group>(null!)
  const innerLight = useRef<THREE.PointLight>(null!)
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null!)
  const seamRing = useRef<THREE.Mesh>(null!)
  const seamMat = useRef<THREE.MeshBasicMaterial>(null!)

  // Cylindrical unwraps of the real vase photo (scripts/make-vase-texture.mjs).
  const [texture, lidTexture] = useTexture(['./vase-body.jpg', './vase-lid.jpg'])
  useMemo(() => {
    for (const tx of [texture, lidTexture]) {
      tx.colorSpace = THREE.SRGBColorSpace
      tx.wrapS = THREE.RepeatWrapping
      tx.wrapT = THREE.ClampToEdgeWrapping
      tx.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy())
      tx.needsUpdate = true
    }
  }, [texture, lidTexture, gl])

  const bodyGeometry = useMemo(
    () => new THREE.LatheGeometry(sampleProfile(BODY_PROFILE, 160), 160),
    [],
  )
  const lidGeometry = useMemo(
    () => new THREE.LatheGeometry(sampleProfile(LID_PROFILE, 96), 128),
    [],
  )

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const pulse01 = 0.5 + 0.5 * Math.sin(t * 2.1)

    // Slow display rotation; the lid is a child and rides along.
    vaseGroup.current.rotation.y = t * 0.15

    // Lid vibration: incommensurate frequencies so it never reads as a loop,
    // with a slow amplitude envelope so it swells and settles.
    const amp = (0.6 + 0.4 * Math.sin(t * 0.8)) * (reducedMotion ? 0.5 : 1)
    lid.current.position.y =
      LID_BASE_Y + amp * (Math.sin(t * 38) * 0.006 + Math.sin(t * 51 + 1.3) * 0.004)
    lid.current.position.x = amp * Math.sin(t * 47 + 0.7) * 0.003
    lid.current.rotation.z = amp * Math.sin(t * 43) * 0.008
    lid.current.rotation.x = amp * Math.sin(t * 36 + 2.1) * 0.008

    // Inner blue light: slow pulse plus a nervous flicker. Kept low and
    // short-range: it should read as a glow inside the porcelain and at the
    // lid seam, not tint the whole vase and pedestal electric blue.
    innerLight.current.intensity =
      (1.4 + 1.0 * pulse01 + 0.15 * Math.sin(t * 13.7)) * 0.3

    // The porcelain breathes with the light.
    bodyMat.current.emissiveIntensity = 0.004 + 0.03 * pulse01

    seamMat.current.opacity = 0.12 + 0.28 * pulse01
    seamRing.current.scale.setScalar(1 + 0.02 * pulse01)
  })

  return (
    <group ref={vaseGroup}>
      {/* DoubleSide so the interior faces catch the inner light through the
          mouth and the lid seam. */}
      <mesh geometry={bodyGeometry}>
        <meshPhysicalMaterial
          ref={bodyMat}
          map={texture}
          roughness={0.42}
          metalness={0}
          clearcoat={0.28}
          clearcoatRoughness={0.25}
          envMapIntensity={0.2}
          emissive="#1a4aff"
          emissiveIntensity={0.006}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        ref={innerLight}
        position={[0, LID_BASE_Y * 0.72, 0]}
        color="#3366ff"
        distance={2.2}
        decay={2}
        intensity={1.6}
      />

      {/* Fake glow ring in the seam gap over the neck rim; the real point
          light spilling through the gap grounds it. */}
      <mesh ref={seamRing} position={[0, real.meta.seamY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[NECK_HALF, 0.014, 8, 64]} />
        <meshBasicMaterial
          ref={seamMat}
          color="#4d7dff"
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={lid} position={[0, LID_BASE_Y, 0]}>
        <mesh geometry={lidGeometry}>
          <meshPhysicalMaterial
            map={lidTexture}
            roughness={0.42}
            metalness={0}
            clearcoat={0.3}
            clearcoatRoughness={0.25}
            envMapIntensity={0.2}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Foo-dog finial like the photo: a pale porcelain knob with the
            small guardian lying on it. Sized to the traced finial box, which
            is ~0.25 units wide, so it reads at the vase's on-screen size
            instead of vanishing to a dot. */}
        <group position={[0, FIN.baseY, 0]} scale={FIN.height / 0.2}>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.1, 0.13, 0.045, 24]} />
            <meshStandardMaterial color="#dcdcd4" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.075, 0]} scale={[1.5, 0.85, 1]}>
            <sphereGeometry args={[0.075, 24, 18]} />
            <meshStandardMaterial color="#cfd0ca" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.14, 0.02]} scale={[1, 1.05, 1]}>
            <sphereGeometry args={[0.062, 20, 16]} />
            <meshStandardMaterial color="#c6c8c4" roughness={0.45} />
          </mesh>
          <mesh position={[0.055, 0.185, 0.03]}>
            <sphereGeometry args={[0.026, 14, 12]} />
            <meshStandardMaterial color="#3a4f7a" roughness={0.4} />
          </mesh>
          <mesh position={[-0.055, 0.185, 0.03]}>
            <sphereGeometry args={[0.026, 14, 12]} />
            <meshStandardMaterial color="#3a4f7a" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.115, -0.075]} rotation={[-0.5, 0, 0]}>
            <coneGeometry args={[0.032, 0.1, 16]} />
            <meshStandardMaterial color="#b9bcbb" roughness={0.45} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
