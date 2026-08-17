// Re-grades the vase textures so the 3D vase renders in the REAL vase's
// colours. The unwraps came from a different, brighter photo, which rendered
// as an electric blue that does not exist in the street photo.
//
// Method: sample the photographed vase's pixels inside its traced silhouette,
// then match the texture's per-channel mean and standard deviation to that
// sample (classic colour transfer). The pattern and shading survive; only the
// colour statistics move onto the real vase's.
// In:  scripts/assets/old-vase-body.jpg / old-vase-lid.jpg (photo unwraps)
// Out: public/vase-body.jpg, public/vase-lid.jpg
// Run: node scripts/grade-vase-textures.mjs
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SRC = 'scripts/assets/street-pro.jpg'
const TARGET_W = 3600

// ---- sample the real vase from the original (un-inpainted) photo ----
const { data, info } = await sharp(SRC)
  .resize({ width: TARGET_W, kernel: 'lanczos3' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const { AXIS, FINIAL_TOP_V, FOOT_BOTTOM_V, MODEL_H, seamY } = real.meta
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
const halfAtY = (profile, y) => {
  for (let i = 1; i < profile.length; i++) {
    if (y <= profile[i][1]) {
      const [r0, y0] = profile[i - 1]
      const [r1, y1] = profile[i]
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0)
      return r0 + (r1 - r0) * t
    }
  }
  return 0
}
const collect = (profile, yFrom, yTo, yOffset = 0) => {
  const px = []
  for (let y = yFrom; y <= yTo; y += 0.004) {
    const half = halfAtY(profile, y)
    if (half <= 0.02) continue
    const row = Math.round(FOOT_BOTTOM_V * H - (y + yOffset) * pxPerUnit)
    if (row < 1 || row >= H - 1) continue
    // stay inside the silhouette (avoid the blurred rim)
    const inner = Math.round(half * pxPerUnit * 0.82)
    for (let dx = -inner; dx <= inner; dx += 2) {
      const x = Math.round(AXIS * W + dx)
      if (x < 0 || x >= W) continue
      const i = (y * 0 + row) * W * 4 + x * 4
      px.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  return px
}
const stats = (px) => {
  const m = [0, 0, 0]
  for (const p of px) for (let c = 0; c < 3; c++) m[c] += p[c]
  for (let c = 0; c < 3; c++) m[c] /= px.length
  const s = [0, 0, 0]
  for (const p of px) for (let c = 0; c < 3; c++) s[c] += (p[c] - m[c]) ** 2
  for (let c = 0; c < 3; c++) s[c] = Math.sqrt(s[c] / px.length)
  return { m, s, n: px.length }
}
const bodyRef = stats(collect(real.body, 0.05, 2.35))
const lidRef = stats(collect(real.lid, 0.02, real.meta.finial.baseY - 0.02, seamY))
console.log('real body', bodyRef.m.map(Math.round), bodyRef.s.map((v) => +v.toFixed(1)), bodyRef.n)
console.log('real lid ', lidRef.m.map(Math.round), lidRef.s.map((v) => +v.toFixed(1)), lidRef.n)

// ---- transfer those statistics onto the unwrapped textures ----
const transfer = async (src, out, ref) => {
  const { data: t, info: ti } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
  const n = ti.width * ti.height
  const ch = ti.channels
  const m = [0, 0, 0]
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) m[c] += t[p * ch + c]
  for (let c = 0; c < 3; c++) m[c] /= n
  const s = [0, 0, 0]
  for (let p = 0; p < n; p++) for (let c = 0; c < 3; c++) s[c] += (t[p * ch + c] - m[c]) ** 2
  for (let c = 0; c < 3; c++) s[c] = Math.sqrt(s[c] / n)
  // keep a little more contrast than the (blur-softened) photo sample
  const gain = ref.s.map((v, c) => Math.min(2.2, (v * 1.25) / Math.max(1, s[c])))
  const outBuf = Buffer.alloc(n * 3)
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      const v = ref.m[c] + (t[p * ch + c] - m[c]) * gain[c]
      outBuf[p * 3 + c] = Math.max(0, Math.min(255, Math.round(v)))
    }
  }
  await sharp(outBuf, { raw: { width: ti.width, height: ti.height, channels: 3 } })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(out)
  console.log(`wrote ${out}  src mean ${m.map(Math.round)} -> ${ref.m.map(Math.round)}  gain ${gain.map((v) => v.toFixed(2))}`)
}
await transfer('scripts/assets/old-vase-body.jpg', 'public/vase-body.jpg', bodyRef)
await transfer('scripts/assets/old-vase-lid.jpg', 'public/vase-lid.jpg', lidRef)
