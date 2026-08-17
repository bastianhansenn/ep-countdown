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

// ---- Exemplar clone with per-row gradient-domain (Poisson) correction ----
// A retoucher clones real road texture over the object rather than smearing a
// gradient. For each row we copy a clean strip of the street from the side
// (translated so a strip of the SAME width lands in the hole), then add a
// smooth per-row colour ramp that forces both edges to match their
// neighbours exactly (a 1-D Poisson solve). Result: real cobble/road texture,
// seamless at the boundary, no smudge and no ghost silhouette. The side with
// the more uniform strip (the open road, not the pallets or the red crate) is
// chosen per row, then a light vertical smoothing hides any side-switch.
const out = Buffer.from(data)
const smooth = (t) => t * t * (3 - 2 * t)
const lumAt = (x, y) => {
  const i = (y * W + x) * 4
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}
const stripVar = (x0, x1, y) => {
  let s = 0, s2 = 0, n = 0
  for (let x = x0; x <= x1; x++) {
    if (x < 0 || x >= W || mask[y * W + x]) return Infinity
    const l = lumAt(x, y)
    s += l
    s2 += l * l
    n++
  }
  if (!n) return Infinity
  return s2 / n - (s / n) ** 2
}
// Pass 1 (road, fv >= 0.5): clone real cobble texture horizontally, seam-
// corrected. Where no uniform road strip exists on either side, skip and let
// the vertical pass handle it.
const ROAD_V = 0.5
for (let y = Math.floor(ROAD_V * H); y < H; y++) {
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
    const canL = L - span >= 0
    const canR = R + span <= W - 1
    const vL = canL ? stripVar(L - span, L - 1, y) : Infinity
    const vR = canR ? stripVar(R + 1, R + span, y) : Infinity
    if (Math.min(vL, vR) >= 900) continue // no cloneable strip -> vertical pass
    const off = vL <= vR ? -span : span
    const li = (y * W + Math.max(0, L - 1)) * 4
    const ri = (y * W + Math.min(W - 1, R + 1)) * 4
    for (let c = 0; c < 3; c++) {
      const mA = data[li + c] - data[(y * W + (L + off)) * 4 + c]
      const mB = data[ri + c] - data[(y * W + (R + off)) * 4 + c]
      for (let xx = L; xx <= R; xx++) {
        const t = span > 1 ? (xx - L) / (span - 1) : 0
        const src = data[(y * W + (xx + off)) * 4 + c]
        out[(y * W + xx) * 4 + c] = Math.max(0, Math.min(255, Math.round(src + mA + (mB - mA) * smooth(t))))
      }
    }
  }
}
// Pass 2 (the distant opening, fv < ROAD_V): information is genuinely missing
// behind the vase here. The natural fill is a smooth harmonic membrane that
// honours ALL its boundaries at once - the bright sky above, the dark framing
// buildings at the sides, the road below (already cloned) - which reproduces
// the soft bright-centre-to-dark-edges gradient of the far street with no
// figure-shaped blob and no streaks. Solved by Jacobi relaxation, only on the
// still-unfilled upper hole; road pixels stay fixed as boundary.
const upper = new Uint8Array(W * H)
const yRoad = Math.floor(ROAD_V * H)
for (let y = 0; y < yRoad; y++)
  for (let x = 0; x < W; x++) if (mask[y * W + x]) upper[y * W + x] = 1
// seed each upper pixel with its row-edge average for faster convergence
for (let y = 0; y < yRoad; y++) {
  let x = 0
  while (x < W) {
    if (!upper[y * W + x]) {
      x++
      continue
    }
    const L = x
    while (x < W && upper[y * W + x]) x++
    const R = x - 1
    const a = (y * W + Math.max(0, L - 1)) * 4
    const b = (y * W + Math.min(W - 1, R + 1)) * 4
    for (let xx = L; xx <= R; xx++) {
      const t = R > L ? (xx - L) / (R - L) : 0
      for (let c = 0; c < 3; c++) out[(y * W + xx) * 4 + c] = Math.round(out[a + c] + (out[b + c] - out[a + c]) * t)
    }
  }
}
const jf = new Float32Array(W * H * 3)
for (let p = 0; p < W * H; p++) for (let c = 0; c < 3; c++) jf[p * 3 + c] = out[p * 4 + c]
for (let pass = 0; pass < 400; pass++) {
  const s = Float32Array.from(jf)
  for (let y = 1; y < yRoad; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x
      if (!upper[p]) continue
      for (let c = 0; c < 3; c++)
        jf[p * 3 + c] = (s[(p - 1) * 3 + c] + s[(p + 1) * 3 + c] + s[(p - W) * 3 + c] + s[(p + W) * 3 + c]) / 4
    }
  }
}
for (let p = 0; p < W * H; p++) {
  if (!upper[p]) continue
  const i = p * 4
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(jf[p * 3 + c])
}
// Final smoothing, region-specific:
//  - the distant opening (fv < ROAD_V) is heavily out of focus in the photo,
//    so dissolve the vertical-interpolation streaks with a wide HORIZONTAL
//    blur into a soft bright patch.
//  - the cobbled road (fv >= ROAD_V) keeps its cloned texture; only a light
//    VERTICAL smoothing hides any row-to-row side-switch seam.
const src = Buffer.from(out)
// The cobbled road keeps its cloned texture; only a light VERTICAL smoothing
// hides any row-to-row side-switch seam. The harmonic opening above is
// already smooth.
for (let y = Math.max(2, Math.floor(ROAD_V * H)); y < H - 2; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x
    if (!mask[p]) continue
    const i = p * 4
    for (let c = 0; c < 3; c++) {
      out[i + c] = Math.round(
        (src[((y - 2) * W + x) * 4 + c] + src[((y - 1) * W + x) * 4 + c] * 2 + src[i + c] * 2 + src[((y + 1) * W + x) * 4 + c] * 2 + src[((y + 2) * W + x) * 4 + c]) / 8,
      )
    }
  }
}

const meta = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .flatten()
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('public/background.jpg')
console.log(`wrote public/background.jpg (${meta.width}x${meta.height}, ${Math.round(meta.size / 1024)} KB)`)
