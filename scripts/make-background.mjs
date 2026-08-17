// Prepares the site backdrop from the professional street photo, with the
// real vase + pedestal painted out (the 3D animated copies stand in their
// place). The removal mask is rasterised from the SAME traced profiles used
// for the 3D meshes (scripts/trace-profiles.mjs), so it covers exactly the
// photographed object; the hole is filled by reflecting the cobbles/street
// inward from both sides (a horizontal crossfade), which continues the
// texture naturally. Daylight is kept; the evening/night grade is a later
// step. Out: public/background.jpg  Run: node scripts/make-background.mjs
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SRC = 'scripts/assets/street-pro.jpg'
const TARGET_W = 3600

const base = await sharp(SRC).resize({ width: TARGET_W, kernel: 'lanczos3' })
const { data, info } = await base.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

// ---- Build the removal mask by rasterising the traced profiles (mirrored
// around the axis) as filled polygons, plus the square plate. ----
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
const lidPts = real.lid.map(([hw, y]) => [hw, seamY + y])
// plate box (square slab), a touch wider than measured to catch its blurred edge
const plTop = rowOf(plate.topY)
const plBot = rowOf(plate.bottomY)
const plHalf = plate.half * pxPerUnit * 1.14
// finial: a narrow box matching the dog itself (the lid poly already covers
// the dome + brim; a wide box here would replace bright far-street beside the
// finial with a smooth bar that shows above the 3D finial tip).
const finTopPy = FINIAL_TOP_V * H - 6
const finBotPy = rowOf(seamY + real.lid[real.lid.length - 1][1])
const svg =
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect x="0" y="0" width="${W}" height="${H}" fill="black"/>` +
  fillPoly(real.body) +
  fillPoly(lidPts) +
  fillPoly(real.pedestal) +
  `<rect x="${(axPx - plHalf).toFixed(1)}" y="${plTop.toFixed(1)}" width="${(plHalf * 2).toFixed(1)}" height="${(plBot - plTop).toFixed(1)}" fill="white"/>` +
  `<rect x="${(axPx - 0.032 * W).toFixed(1)}" y="${finTopPy.toFixed(1)}" width="${(0.064 * W).toFixed(1)}" height="${(finBotPy - finTopPy).toFixed(1)}" fill="white"/>` +
  `</svg>`

// Rasterise + dilate the mask so no object edge, blossom, or contact shadow
// survives just outside it (those get mirrored inward and read as floating
// specks), without grabbing so much bright far-street that the fill streaks.
const maskRaw = await sharp(Buffer.from(svg))
  .blur(12)
  .raw()
  .toBuffer()
const maskCh = maskRaw.length / (W * H)
const mask = new Uint8Array(W * H)
for (let p = 0; p < W * H; p++) mask[p] = maskRaw[p * maskCh] > 30 ? 1 : 0

// ---- Horizontal reflect-crossfade inpaint per row ----
const out = Buffer.from(data)
const px = (x, y) => {
  const i = (y * W + x) * 4
  return [data[i], data[i + 1], data[i + 2]]
}
for (let y = 0; y < H; y++) {
  // contiguous masked spans in this row
  let x = 0
  while (x < W) {
    if (!mask[y * W + x]) {
      x++
      continue
    }
    let L = x
    while (x < W && mask[y * W + x]) x++
    let R = x - 1
    const span = R - L
    if (span < 1) continue
    const smooth = (t) => t * t * (3 - 2 * t)
    // Reflect from a clean margin OUTSIDE the span (not the immediately
    // adjacent pixels, which still carry the object's blurred halo).
    const M = 6
    for (let xx = L; xx <= R; xx++) {
      const t = (xx - L) / span
      let mLx = L - M - (xx - L)
      let mRx = R + M + (R - xx)
      mLx = Math.max(0, Math.min(W - 1, mLx))
      mRx = Math.max(0, Math.min(W - 1, mRx))
      // walk a masked mirror source outward until it lands on clean street
      let g = 0
      while (mask[y * W + mLx] && mLx > 0 && g++ < 400) mLx--
      g = 0
      while (mask[y * W + mRx] && mRx < W - 1 && g++ < 400) mRx++
      const cL = px(mLx, y)
      const cR = px(mRx, y)
      const w = smooth(t)
      const i = (y * W + xx) * 4
      out[i] = cL[0] * (1 - w) + cR[0] * w
      out[i + 1] = cL[1] * (1 - w) + cR[1] * w
      out[i + 2] = cL[2] * (1 - w) + cR[2] * w
    }
  }
}

// Blur confined to the mask to soften the centre seam and any tiling. The
// filled region sits in the photo's deep-bokeh zone, so a strong blur there
// matches the surrounding out-of-focus cobbles.
const blurred = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .blur(6)
  .raw()
  .toBuffer()
for (let p = 0; p < W * H; p++) {
  if (!mask[p]) continue
  const i = p * 4
  for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] * 0.55 + blurred[i + c] * 0.45)
}

const meta = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
  .flatten()
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile('public/background.jpg')
console.log(`wrote public/background.jpg (${meta.width}x${meta.height}, ${Math.round(meta.size / 1024)} KB)`)
