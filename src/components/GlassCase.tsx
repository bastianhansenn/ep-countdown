// Clear museum glass around the vase: real refraction (the street photo is an
// in-scene backdrop, so the transmission pass can see it) with no blur and
// little reflection, so the vase stays sharp behind it. No drawn edges: a
// crisp outline reads as a floating rectangle rather than glass; the subtle
// refraction offset at the sides is what makes it legible as a vitrine.
export default function GlassCase() {
  return (
    <mesh position={[0, 1.62, 0]}>
      <boxGeometry args={[2.15, 3.35, 2.15]} />
      <meshPhysicalMaterial
        color="#ffffff"
        transmission={1}
        thickness={0.015}
        roughness={0.03}
        ior={1.45}
        metalness={0}
        envMapIntensity={0.18}
        specularIntensity={0.35}
      />
    </mesh>
  )
}
