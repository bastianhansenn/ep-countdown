import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { BODY_PROFILE, LID_PROFILE, sampleProfile } from '../lib/vaseProfiles'

const LID_BASE_Y = 2.52

export default function Vase() {
  const gl = useThree((s) => s.gl)

  const vaseGroup = useRef<THREE.Group>(null!)
  const lid = useRef<THREE.Group>(null!)
  const innerLight = useRef<THREE.PointLight>(null!)
  const bodyMat = useRef<THREE.MeshPhysicalMaterial>(null!)
  const seamRing = useRef<THREE.Mesh>(null!)
  const seamMat = useRef<THREE.MeshBasicMaterial>(null!)

  // Cylindrical unwraps of the real vase photo (scripts/make-vase-texture.mjs).
  const [texture, lidTexture] = useTexture(['./vase-body.png', './vase-lid.png'])
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
    () => new THREE.LatheGeometry(sampleProfile(BODY_PROFILE, 128), 160),
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

    // Inner blue light: slow pulse plus a nervous flicker.
    innerLight.current.intensity =
      (1.4 + 1.0 * pulse01 + 0.15 * Math.sin(t * 13.7)) * 2

    // The porcelain breathes with the light.
    bodyMat.current.emissiveIntensity = 0.03 + 0.12 * pulse01

    seamMat.current.opacity = 0.25 + 0.5 * pulse01
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
          roughness={0.15}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.08}
          envMapIntensity={1}
          emissive="#1a4aff"
          emissiveIntensity={0.03}
          side={THREE.DoubleSide}
        />
      </mesh>

      <pointLight
        ref={innerLight}
        position={[0, 1.9, 0]}
        color="#3366ff"
        distance={4}
        decay={2}
        intensity={3.8}
      />

      {/* Fake glow ring in the 0.02 seam gap; the real point light spilling
          through the gap grounds it. */}
      <mesh ref={seamRing} position={[0, 2.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.26, 0.012, 8, 48]} />
        <meshBasicMaterial
          ref={seamMat}
          color="#4d7dff"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <group ref={lid} position={[0, LID_BASE_Y, 0]}>
        <mesh geometry={lidGeometry}>
          <meshPhysicalMaterial
            map={lidTexture}
            roughness={0.2}
            metalness={0}
            clearcoat={1}
            clearcoatRoughness={0.12}
            envMapIntensity={0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Foo-dog finial like the photo: pale porcelain knob base with a
            two-tone guardian silhouette on top. */}
        <group position={[0, 0.26, 0]}>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.03, 24]} />
            <meshStandardMaterial color="#e8e6df" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.06, 0]} scale={[1, 0.8, 1.25]}>
            <sphereGeometry args={[0.055, 24, 18]} />
            <meshStandardMaterial color="#dcd9d0" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.115, 0.045]}>
            <sphereGeometry args={[0.038, 20, 16]} />
            <meshStandardMaterial color="#31519e" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.1, -0.055]} rotation={[-0.6, 0, 0]}>
            <coneGeometry args={[0.022, 0.06, 16]} />
            <meshStandardMaterial color="#31519e" roughness={0.25} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
