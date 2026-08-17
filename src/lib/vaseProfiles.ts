import * as THREE from 'three'

// Lathe profiles as (x = radius, y = height) control points, bottom to top,
// matched to the reference photo: slender baluster with a flared white foot,
// slim lower body, full high shoulder in the upper third, and a short
// straight neck. The profile starts at the foot rim (never x = 0), so the
// visible surface has no UV pole for the texture to smear at.
export const BODY_PROFILE: [number, number][] = [
  [0.42, 0.0],
  [0.44, 0.05],
  [0.38, 0.12],
  [0.35, 0.22],
  [0.36, 0.4],
  [0.42, 0.62],
  [0.5, 0.85],
  [0.58, 1.08],
  [0.64, 1.32],
  [0.66, 1.55],
  [0.63, 1.78],
  [0.55, 1.98],
  [0.4, 2.15],
  [0.28, 2.28],
  [0.24, 2.38],
  [0.24, 2.5],
]

// Lid local y = 0 sits at world y = 2.52, leaving a 0.02 seam gap over the
// 0.24-radius mouth. The wide flat 0.40-0.44 brim overhangs the neck like
// the photo's lid, folding back into a low dome.
export const LID_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.24, 0.0],
  [0.4, 0.01],
  [0.44, 0.045],
  [0.4, 0.08],
  [0.3, 0.13],
  [0.2, 0.19],
  [0.1, 0.235],
  [0.055, 0.26],
]

// getSpacedPoints (arc-length uniform) keeps the lathe V coordinate advancing
// evenly along the surface, so texels per surface unit stay uniform.
export function sampleProfile(
  points: [number, number][],
  samples: number,
): THREE.Vector2[] {
  const curve = new THREE.SplineCurve(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
  )
  return curve.getSpacedPoints(samples)
}
