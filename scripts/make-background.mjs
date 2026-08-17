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
// The mask must remove the object AND its blur halo, but stay small enough
// that the 3D copy (scaled by COVER_SCALE in Scene.tsx) covers every filled
// pixel. These margins are the minimum that erased the halo in testing;
// scripts/check-coverage.mjs verifies the 3D silhouette still contains them.
const lidPts = real.lid.map(([hw, y]) => [hw * 1.05 + 0.012, seamY + y])
// The turned pedestal alternates wide discs and narrow necks, and the trace
// under-measures the discs' blurred flanks. Removing only the traced width
// leaves bright nubs of the real discs beside the 3D column. So the MASK uses
// a windowed maximum of the profile (each row inherits the widest width
// nearby), which sweeps the whole turned silhouette away; the extra removed
// sliver next to the necks is blurred cobble, which the smooth fill matches.
const pedMaxWin = real.pedestal.map((_, i, arr) => {
  let m = 0
  for (let k = Math.max(0, i - 8); k <= Math.min(arr.length - 1, i + 8); k++)
    m = Math.max(m, arr[k][0])
  return [m * 1.16 + 0.02, arr[i][1]]
})
const pedWide = pedMaxWin
// The plate is a board seen slightly from above, so its lit TOP FACE extends
// ~40px above the traced front edge. The 3D plate's own top face covers those
// rows in perspective, so masking them is safe and removes the light band.
const plTop = rowOf(plate.topY) - 42
const plBot = rowOf(plate.bottomY) + 6
const plHalf = plate.half * pxPerUnit
const finTopPy = FINIAL_TOP_V * H - 14
const finBotPy = rowOf(seamY + real.lid[real.lid.length - 1][1])
const svg =
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="${W}" height="${H}" fill="black"/>` +
  fillPoly(real.body) +
  fillPoly(lidPts) +
  fillPoly(pedWide) +
  `<rect x="${(axPx - plHalf).toFixed(1)}" y="${plTop.toFixed(1)}" width="${(plHalf * 2).toFixed(1)}" height="${(plBot - plTop).toFixed(1)}" fill="white"/>` +
  `<rect x="${(axPx - 0.028 * W).toFixed(1)}" y="${finTopPy.toFixed(1)}" width="${(0.056 * W).toFixed(1)}" height="${(finBotPy - finTopPy).toFixed(1)}" fill="white"/>` +
  `</svg>`

// Rasterise + dilate (blur) so the whole object, its blurred halo and its
// contact shadow are inside the hole.
const maskRaw = await sharp(Buffer.from(svg)).blur(11).raw().toBuffer()
const maskCh = maskRaw.length / (W * H)
const mask = new Uint8Array(W * H) // 1 = hole, 0 = keep
for (let p = 0; p < W * H; p++) mask[p] = maskRaw[p * maskCh] > 30 ? 1 : 0
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

// ---- Fill ----
// The whole background is deep bokeh (the vase was the only thing in focus),
// so behind it there is no sharp structure, only a smooth continuation of the
// surrounding out-of-focus tones. The right fill is therefore a single smooth
// harmonic membrane spanning the hole (it interpolates the real boundary
// tones - bright far street up top, cobble tones lower - with no blob, seam
// or streak), plus a faint grain re-introduced low down where the near
// cobbles are only mildly blurred.
const out = Buffer.from(data)
const smooth = (t) => t * t * (3 - 2 * t)

// Seed each row by linear interpolation between its two clean edges.
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
    const a = (y * W + Math.max(0, L - 1)) * 4
    const b = (y * W + Math.min(W - 1, R + 1)) * 4
    for (let xx = L; xx <= R; xx++) {
      const t = R > L ? (xx - L) / (R - L) : 0
      for (let c = 0; c < 3; c++)
        out[(y * W + xx) * 4 + c] = Math.round(out[a + c] + (out[b + c] - out[a + c]) * t)
    }
  }
}
// Gauss-Seidel harmonic relaxation over the hole (in place: converges about
// twice as fast as Jacobi). Only the masked pixels are iterated; boundary
// pixels stay fixed. Row-major order (interior pixels avoid the frame edge).
const hole = []
for (let y = 1; y < H - 1; y++)
  for (let x = 1; x < W - 1; x++) if (mask[y * W + x]) hole.push(y * W + x)
const jf = new Float32Array(W * H * 3)
for (let p = 0; p < W * H; p++) for (let c = 0; c < 3; c++) jf[p * 3 + c] = out[p * 4 + c]
for (let pass = 0; pass < 600; pass++) {
  for (let k = 0; k < hole.length; k++) {
    const p = hole[k]
    const p3 = p * 3
    jf[p3] = (jf[(p - 1) * 3] + jf[(p + 1) * 3] + jf[(p - W) * 3] + jf[(p + W) * 3]) / 4
    jf[p3 + 1] = (jf[(p - 1) * 3 + 1] + jf[(p + 1) * 3 + 1] + jf[(p - W) * 3 + 1] + jf[(p + W) * 3 + 1]) / 4
    jf[p3 + 2] = (jf[(p - 1) * 3 + 2] + jf[(p + 1) * 3 + 2] + jf[(p - W) * 3 + 2] + jf[(p + W) * 3 + 2]) / 4
  }
}
for (let k = 0; k < hole.length; k++) {
  const p = hole[k]
  const i = p * 4
  out[i] = Math.round(jf[p * 3])
  out[i + 1] = Math.round(jf[p * 3 + 1])
  out[i + 2] = Math.round(jf[p * 3 + 2])
}

// Inject the distant opening's brightness. Behind the vase's upper half is
// the bright far end of the street, but it is fully occluded, so the harmonic
// (which only sees the darker immediate surroundings) fills it too dark and
// reads as a grey blob. Sample the real opening colour from the bright band
// just above the vase and lift the hole interior toward it, most in the top
// centre and fading to nothing at the edges (so the boundary stays seamless)
// and by the time the road surface begins.
const sampleBox = (x0, x1, y0, y1) => {
  let r = 0, g = 0, b = 0, n = 0
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H || mask[y * W + x]) continue
      const i = (y * W + x) * 4
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
    }
  return n ? [r / n, g / n, b / n] : [200, 195, 185]
}
const axPxi = Math.round(AXIS * W)
const bright = sampleBox(axPxi - 140, axPxi + 140, Math.round(0.22 * H), Math.round(0.28 * H))
for (let y = 0; y < Math.round(0.56 * H); y++) {
  const heightW = 1 - smooth(Math.max(0, Math.min(1, (y / H - 0.3) / 0.26)))
  if (heightW <= 0.001) continue
  let x = 0
  while (x < W) {
    if (!mask[y * W + x]) {
      x++
      continue
    }
    const L = x
    while (x < W && mask[y * W + x]) x++
    const R = x - 1
    for (let xx = L; xx <= R; xx++) {
      const dEdge = Math.min(xx - L, R - xx)
      const interiorW = smooth(Math.max(0, Math.min(1, dEdge / 70)))
      const lift = interiorW * heightW * 0.82
      const i = (y * W + xx) * 4
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * (1 - lift) + bright[c] * lift)
    }
  }
}

// Re-introduce faint cobble grain low in the frame (near cobbles are only
// mildly out of focus). Add the surrounding HIGH-FREQUENCY detail translated
// in from each side and crossfaded; strength ramps from 0 in the deep bokeh
// up to a modest amount at the bottom, so the smooth opening is untouched.
const blurRaw = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .blur(4)
  .raw()
  .toBuffer()
const detail = (x, y, c) => data[(y * W + x) * 4 + c] - blurRaw[(y * W + x) * 4 + c]
for (let y = 0; y < H; y++) {
  const grain = smooth(Math.max(0, Math.min(1, (y / H - 0.58) / 0.25))) * 0.85
  if (grain <= 0.001) continue
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
        out[i + c] = Math.max(0, Math.min(255, out[i + c] + d * grain))
      }
    }
  }
}

const meta = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .flatten()
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('public/background.jpg')
console.log(`wrote public/background.jpg (${meta.width}x${meta.height}, ${Math.round(meta.size / 1024)} KB)`)
