import { Edges } from '@react-three/drei'

// Clear museum glass: real refraction (the night photo is an in-scene
// backdrop, so the transmission pass can see it) but zero blur and minimal
// reflection, so the vase stays bright and sharp behind it.
export default function GlassCase() {
  return (
    <mesh position={[0, 1.65, 0]}>
      <boxGeometry args={[1.8, 3.4, 1.8]} />
      <meshPhysicalMaterial
        color="#ffffff"
        transmission={1}
        thickness={0.01}
        roughness={0}
        ior={1.45}
        metalness={0}
        envMapIntensity={0.3}
        specularIntensity={0.6}
      />
      <Edges color="#1c2438" />
    </mesh>
  )
}
