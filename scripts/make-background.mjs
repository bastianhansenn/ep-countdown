// Prepares the site backdrop from the professional street photo, with the
// real vase + pedestal painted out so the photo reads as a completely normal
// empty street (the 3D animated copies stand in their place at runtime).
//
// The removal mask is rasterised from the SAME traced profiles used for the
// 3D meshes (scripts/trace-profiles.mjs). The hole is filled with a pyramid
// pull-push inpaint: the surrounding pixels diffuse smoothly inward across
// scales, so there are no streaks, seams or floating specks. The object sits
// in the photo's deep-bokeh zone, so the smooth fill matches the out-of-focus
// street around it. Daylight is kept; the evening/night grade is a later step.
// Out: public/background.jpg  Run: node scripts/make-background.mjs
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SRC = 'scripts/assets/street-pro.jpg'
const TARGET_W = 3600

const base = sharp(SRC).resize({ width: TARGET_W, kernel: 'lanczos3' })
const { data, info } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

// ---- Removal mask: rasterise the traced profiles (mirrored around the axis)
// as filled polygons, plus the square plate and a finial box. ----
const { AXIS, FINIAL_TOP_V, FOOT_BOTTOM_V, MODEL_H, seamY, plate } = real.meta
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
const footPy = FOOT_BOTTOM_V * H
const axPx = AXIS * W
const rowOf = (y) => footPy - y * pxPerUnit
const xOf = (half, sign) => axPx + sign * half * pxPerUnit
const fillPoly = (pts) => {
  const up = pts.map(([hw, y]) => `${xOf(hw, 1).toFixed(1)},${rowOf(y).toFixed(1)}`)
  const dn = pts.map(([hw, y]) => `${xOf(hw, -1).toFixed(1)},${rowOf(y).toFixed(1)}`).reverse()
  return `<polygon points="${[...up, ...dn].join(' ')}" fill="white"/>`
}
// Widen the lid silhouette a little for the mask so the brim's bright edge
// highlights don't survive just outside it as specks.
const lidPts = real.lid.map(([hw, y]) => [hw * 1.14 + 0.03, seamY + y])
// The turned pedestal's disc rings flare a bit wider than the traced column
// profile, so widen the pedestal silhouette for the mask (not for the mesh).
const pedWide = real.pedestal.map(([hw, y]) => [hw * 1.4 + 0.05, y])
// Extend the plate mask ~45px above plate.topY: the black plate's bright top
// face is visible in perspective and pokes above the traced top plane,
// leaving a bright streak otherwise. Widen it a touch too.
const plTop = rowOf(plate.topY) - 45
const plBot = rowOf(plate.bottomY) + 10
const plHalf = plate.half * pxPerUnit * 1.24
const finTopPy = FINIAL_TOP_V * H - 28
const finBotPy = rowOf(seamY + real.lid[real.lid.length - 1][1])
const svg =
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="${W}" height="${H}" fill="black"/>` +
  fillPoly(real.body) +
  fillPoly(lidPts) +
  fillPoly(pedWide) +
  `<rect x="${(axPx - plHalf).toFixed(1)}" y="${plTop.toFixed(1)}" width="${(plHalf * 2).toFixed(1)}" height="${(plBot - plTop).toFixed(1)}" fill="white"/>` +
  `<rect x="${(axPx - 0.07 * W).toFixed(1)}" y="${finTopPy.toFixed(1)}" width="${(0.14 * W).toFixed(1)}" height="${(finBotPy - finTopPy).toFixed(1)}" fill="white"/>` +
  `</svg>`

// Rasterise + dilate (blur) so the whole object, its blurred halo and its
// contact shadow are inside the hole.
const maskRaw = await sharp(Buffer.from(svg)).blur(18).raw().toBuffer()
const maskCh = maskRaw.length / (W * H)
const mask = new Uint8Array(W * H) // 1 = hole, 0 = keep
for (let p = 0; p < W * H; p++) mask[p] = maskRaw[p * maskCh] > 24 ? 1 : 0
// Close the mask per row: fill every pixel between the first and last masked
// pixel of the row. The turned pedestal's profile pinches to thin necks
// between its discs, so the rasterised silhouette leaves notches where
// slivers of the real dark pedestal survive as specks; this seals them.
for (let y = 0; y < H; y++) {
  let first = -1
  let last = -1
  for (let x = 0; x < W; x++)
    if (mask[y * W + x]) {
      if (first < 0) first = x
      last = x
    }
  if (first >= 0) for (let x = first; x <= last; x++) mask[y * W + x] = 1
}

// ---- Smooth-membrane fill ----
// The object sits in the photo's deep-bokeh zone, so the correct fill is a
// smooth surface spanning the hole, NOT copied structure (copying re-creates
// ghost silhouettes/specks). Each row is seeded by a linear interpolation
// between the average colour of a clean strip on its left and on its right,
// which keeps the photo's horizontal bands (sky, far street, cobbles). Then
// a few Jacobi smoothing passes turn the seed into a harmonic membrane that
// is continuous with the surroundings in both directions.
const out = Buffer.from(data)
const edgeAvg = (y, from, dir) => {
  let sr = 0, sg = 0, sb = 0, n = 0
  let xx = from
  for (let k = 0; k < 24 && xx >= 0 && xx < W; k++, xx += dir) {
    if (mask[y * W + xx]) continue
    const i = (y * W + xx) * 4
    sr += data[i]
    sg += data[i + 1]
    sb += data[i + 2]
    n++
  }
  if (!n) return null
  return [sr / n, sg / n, sb / n]
}
const smooth = (t) => t * t * (3 - 2 * t)
for (let y = 0; y < H; y++) {
  let x = 0
  while (x < W) {
    if (!mask[y * W + x]) {
      x++
      continue
    }
    const L = x
    while (x < W && mask[y * W + x]) x++
    const R = x - 1
    const span = R - L + 1
    const cL = edgeAvg(y, L - 1, -1) || edgeAvg(y, R + 1, 1) || [128, 128, 128]
    const cR = edgeAvg(y, R + 1, 1) || cL
    for (let xx = L; xx <= R; xx++) {
      const w = smooth(span > 1 ? (xx - L) / (span - 1) : 0)
      const i = (y * W + xx) * 4
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(cL[c] * (1 - w) + cR[c] * w)
    }
  }
}
// Jacobi smoothing confined to the hole (boundary pixels stay fixed): turns
// the per-row seed into a membrane smooth in both directions, erasing any
// row-to-row banding.
let buf = new Float32Array(W * H * 3)
for (let p = 0; p < W * H; p++)
  for (let c = 0; c < 3; c++) buf[p * 3 + c] = out[p * 4 + c]
for (let pass = 0; pass < 60; pass++) {
  const src = Float32Array.from(buf)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x
      if (!mask[p]) continue
      for (let c = 0; c < 3; c++) {
        buf[p * 3 + c] =
          (src[(p - 1) * 3 + c] + src[(p + 1) * 3 + c] + src[(p - W) * 3 + c] + src[(p + W) * 3 + c]) / 4
      }
    }
  }
}
for (let p = 0; p < W * H; p++) {
  if (!mask[p]) continue
  const i = p * 4
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(buf[p * 3 + c])
}

// ---- Texture pass ----
// The membrane is smooth; the cobbles around it carry fine grain. Add the
// surrounding HIGH-FREQUENCY detail (photo minus a small blur) translated in
// from each side and crossfaded. Detail is near-zero-mean and structureless,
// so this grains the fill to match the cobbles without re-creating any object
// shape.
const blurRaw = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .blur(5)
  .raw()
  .toBuffer()
const detail = (x, y, c) => {
  const i = (y * W + x) * 4 + c
  return data[i] - blurRaw[i]
}
for (let y = 0; y < H; y++) {
  let x = 0
  while (x < W) {
    if (!mask[y * W + x]) {
      x++
      continue
    }
    const L = x
    while (x < W && mask[y * W + x]) x++
    const R = x - 1
    const span = R - L + 1
    let lc = L - 1
    while (lc > 0 && mask[y * W + lc]) lc--
    let rc = R + 1
    while (rc < W - 1 && mask[y * W + rc]) rc++
    for (let xx = L; xx <= R; xx++) {
      const w = smooth(span > 1 ? (xx - L) / (span - 1) : 0)
      let sl = xx - span
      if (sl < 0 || mask[y * W + sl]) sl = lc
      let sr = xx + span
      if (sr > W - 1 || mask[y * W + sr]) sr = rc
      const i = (y * W + xx) * 4
      for (let c = 0; c < 3; c++) {
        const d = detail(sl, y, c) * (1 - w) + detail(sr, y, c) * w
        out[i + c] = Math.max(0, Math.min(255, out[i + c] + d * 0.9))
      }
    }
  }
}

const meta = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .flatten()
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('public/background.jpg')
console.log(`wrote public/background.jpg (${meta.width}x${meta.height}, ${Math.round(meta.size / 1024)} KB)`)
