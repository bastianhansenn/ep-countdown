// Unwraps the REAL vase from the street photo into cylindrical textures for
// the lathe meshes, using the same traced profile the meshes are built from.
// The old textures came from a different photo and smeared at the foot; this
// samples the actual subject, so colour, pattern and shading all match.
//
// Each texture row maps to the photo row at that model height; each column
// samples across the vase's measured half-width. Two mirrored panels around
// the circumference keep the wrap seamless with no smearing at the edges.
// Out: public/vase-body.jpg, public/vase-lid.jpg
// Run: node scripts/make-vase-texture.mjs
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SRC = 'scripts/assets/street-pro.jpg'
const TARGET_W = 3600
const BODY_SIZE = 1024
const LID_SIZE = 512

const { data, info } = await sharp(SRC)
  .resize({ width: TARGET_W, kernel: 'lanczos3' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const { AXIS, FINIAL_TOP_V, FOOT_BOTTOM_V, MODEL_H, seamY, finial } = real.meta
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
const footPy = FOOT_BOTTOM_V * H
const cx = AXIS * W

const halfAt = (profile, y) => {
  if (y <= profile[0][1]) return profile[0][0]
  for (let i = 1; i < profile.length; i++) {
    if (y <= profile[i][1]) {
      const [r0, y0] = profile[i - 1]
      const [r1, y1] = profile[i]
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0)
      return r0 + (r1 - r0) * t
    }
  }
  return profile[profile.length - 1][0]
}
// LatheGeometry's V coordinate advances with ARC LENGTH along the profile
// (sampleProfile uses getSpacedPoints), not with height. Sampling the photo
// linearly in y would slide the texture off features that turn sharply -- the
// lid's wide white brim covers little height but a lot of arc. So resample the
// profile at equal arc length and drive the texture from that.
const arcResample = (profile, yFrom, yTo, steps) => {
  const dense = []
  const N = 2000
  for (let i = 0; i <= N; i++) {
    const y = yFrom + (i / N) * (yTo - yFrom)
    dense.push([halfAt(profile, y), y])
  }
  const cum = [0]
  for (let i = 1; i < dense.length; i++) {
    const dx = dense[i][0] - dense[i - 1][0]
    const dy = dense[i][1] - dense[i - 1][1]
    cum.push(cum[i - 1] + Math.hypot(dx, dy))
  }
  const total = cum[cum.length - 1]
  const out = []
  let j = 0
  for (let k = 0; k < steps; k++) {
    const target = (k / (steps - 1)) * total
    while (j < cum.length - 2 && cum[j + 1] < target) j++
    const span = cum[j + 1] - cum[j] || 1
    const t = (target - cum[j]) / span
    out.push([
      dense[j][0] + (dense[j + 1][0] - dense[j][0]) * t,
      dense[j][1] + (dense[j + 1][1] - dense[j][1]) * t,
    ])
  }
  return out
}

const sample = (fx, fy) => {
  const x = Math.max(0, Math.min(W - 1, Math.round(fx)))
  const y = Math.max(0, Math.min(H - 1, Math.round(fy)))
  const i = (y * W + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}
// The photo's own left-right shading is flattened GENTLY: the lathe is lit by
// the scene, so leaving all of it would double up, but removing it flattens
// the glaze into a wash. The per-row reference brightness is smoothed
// vertically first, otherwise row-to-row noise prints as horizontal rings.
const unwrap = (size, profile, yFrom, yTo, inset) => {
  const arc = arcResample(profile, yFrom, yTo, size)
  const rows = []
  for (let ty = 0; ty < size; ty++) {
    // texture row 0 is the TOP (v = 1), arc index 0 is the bottom
    const [halfU, y] = arc[size - 1 - ty]
    const row = footPy - y * pxPerUnit
    const R = halfU * pxPerUnit
    let mean = 0
    for (let k = -8; k <= 8; k++) {
      const c = sample(cx + (k / 8) * R * inset, row)
      mean += (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 17
    }
    rows.push({ row, R, mean })
  }
  for (let pass = 0; pass < 6; pass++) {
    const m = rows.map((r) => r.mean)
    for (let i = 1; i < rows.length - 1; i++) rows[i].mean = (m[i - 1] + m[i] * 2 + m[i + 1]) / 4
  }
  const out = Buffer.alloc(size * size * 3)
  for (let ty = 0; ty < size; ty++) {
    const { row, R, mean } = rows[ty]
    for (let tx = 0; tx < size; tx++) {
      const u = tx / size
      const f = (u * 2 + 0.25) % 1
      const tri = f < 0.5 ? f * 2 : 2 - f * 2
      const s = (tri * 2 - 1) * inset
      const c = sample(cx + s * R, row)
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
      const k = mean > 4 ? 1 + 0.22 * (mean / Math.max(4, l) - 1) : 1
      const i = (ty * size + tx) * 3
      // k flattens the baked shading; the 1.12/-8 curve puts back the glaze
      // depth that averaging costs.
      out[i] = Math.max(0, Math.min(255, Math.round(c[0] * k * 1.12 - 8)))
      out[i + 1] = Math.max(0, Math.min(255, Math.round(c[1] * k * 1.12 - 8)))
      out[i + 2] = Math.max(0, Math.min(255, Math.round(c[2] * k * 1.12 - 8)))
    }
  }
  return out
}

const body = unwrap(BODY_SIZE, real.body, 0.02, seamY - 0.01, 0.86)
await sharp(body, { raw: { width: BODY_SIZE, height: BODY_SIZE, channels: 3 } })
  .sharpen({ sigma: 0.8, m1: 0.7, m2: 0.4 })
  .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
  .toFile('public/vase-body.jpg')

const lidProfileAbs = real.lid.map(([hw, y]) => [hw, seamY + y])
const lid = unwrap(LID_SIZE, lidProfileAbs, seamY + 0.01, seamY + finial.baseY - 0.01, 0.84)
await sharp(lid, { raw: { width: LID_SIZE, height: LID_SIZE, channels: 3 } })
  .sharpen({ sigma: 0.8, m1: 0.7, m2: 0.4 })
  .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
  .toFile('public/vase-lid.jpg')

console.log('wrote public/vase-body.jpg and public/vase-lid.jpg from the street photo')
