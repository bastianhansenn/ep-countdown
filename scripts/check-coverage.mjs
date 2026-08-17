// Verifies that the 3D ensemble (vase + lid + finial + pedestal + plate)
// covers the inpainted region, so no filled pixel is ever visible beside it.
//
// Reproduces the exact projection Scene.tsx uses: the ensemble sits at
// z = BACKDROP_Z + 0.3, i.e. slightly in FRONT of the backdrop plane, so it
// projects R = 24 / 23.7 larger than the 1:1 mapping. In image pixels:
//   px = W*(0.5 + R*(VASE_U - 0.5)) + R*half*pxPerUnit
//   py = H*(0.5 - R*(0.5 - VASE_BASE_V)) - R*y*pxPerUnit
// Out: scratchpad/coverage.png (red = inpainted but NOT covered)
// Run: node scripts/check-coverage.mjs
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SP = 'C:/Users/basti/AppData/Local/Temp/claude/C--Users-basti-OneDrive-Documents-GitHub-ProReach/84e84cf5-8c45-435b-b3ec-b99ae747f174/scratchpad/'
const { AXIS, FINIAL_TOP_V, FOOT_BOTTOM_V, MODEL_H, seamY, plate } = real.meta
const ENSEMBLE_SCALE = Number(process.argv[2] || 1) // extra uniform scale

const meta = await sharp('public/background.jpg').metadata()
const W = meta.width
const H = meta.height
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
// The group ORIGIN (the vase foot) is placed from the cover math and is not
// affected by COVER_SCALE; only the model scale is. So the anchor uses R0
// alone while sizes use R0 * COVER_SCALE: the foot stays put and the ensemble
// grows outward/upward from it.
const R0 = 24 / 23.7 // ensemble sits 0.3 in front of the backdrop plane
const RS = R0 * ENSEMBLE_SCALE
const cx = W * (0.5 + R0 * (AXIS - 0.5))
const cy = H * (0.5 - R0 * (0.5 - FOOT_BOTTOM_V))
const xOf = (half, sign) => cx + sign * half * pxPerUnit * RS
const rowOf = (y) => cy - y * pxPerUnit * RS

// ---- rasterise the 3D silhouette (what the meshes actually are) ----
const poly = (pts) => {
  const up = pts.map(([hw, y]) => `${xOf(hw, 1).toFixed(1)},${rowOf(y).toFixed(1)}`)
  const dn = pts.map(([hw, y]) => `${xOf(hw, -1).toFixed(1)},${rowOf(y).toFixed(1)}`).reverse()
  return `<polygon points="${[...up, ...dn].join(' ')}" fill="white"/>`
}
const lidPts = real.lid.map(([hw, y]) => [hw, seamY + y])
// finial primitives: a cone of influence from the dome top to the finial top
const finTop = seamY + real.meta.finial.baseY + real.meta.finial.height
const finBase = seamY + real.meta.finial.baseY
const finialPts = [
  [0.14, finBase],
  [0.13, finBase + (finTop - finBase) * 0.5],
  [0.05, finTop],
]
// must mirror Pedestal.tsx
const PED_COVER = 1.16
const PLATE_COVER = 1.0
const plateTop = plate.topY + 0.03
const plateBottom = plate.bottomY - 0.01
const plateHalf = plate.half * PLATE_COVER
const plateH = plateTop - plateBottom
const pedCover = real.pedestal.map(([hw, y]) => [hw * PED_COVER, y])
const svg =
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="${W}" height="${H}" fill="black"/>` +
  poly(real.body) +
  poly(lidPts) +
  poly(finialPts) +
  poly(pedCover) +
  `<rect x="${xOf(plateHalf, -1).toFixed(1)}" y="${rowOf(plateTop).toFixed(1)}" width="${(plateHalf * 2 * pxPerUnit * RS).toFixed(1)}" height="${(plateH * pxPerUnit * RS).toFixed(1)}" fill="white"/>` +
  `</svg>`
const silRaw = await sharp(Buffer.from(svg)).raw().toBuffer()
const silCh = silRaw.length / (W * H)
const sil = new Uint8Array(W * H)
for (let p = 0; p < W * H; p++) sil[p] = silRaw[p * silCh] > 128 ? 1 : 0

// ---- rebuild the inpaint mask exactly as make-background.mjs does ----
const footPy = FOOT_BOTTOM_V * H
const axPx = AXIS * W
const rowOfM = (y) => footPy - y * pxPerUnit
const xOfM = (half, sign) => axPx + sign * half * pxPerUnit
const polyM = (pts) => {
  const up = pts.map(([hw, y]) => `${xOfM(hw, 1).toFixed(1)},${rowOfM(y).toFixed(1)}`)
  const dn = pts.map(([hw, y]) => `${xOfM(hw, -1).toFixed(1)},${rowOfM(y).toFixed(1)}`).reverse()
  return `<polygon points="${[...up, ...dn].join(' ')}" fill="white"/>`
}
const lidWide = real.lid.map(([hw, y]) => [hw * 1.05 + 0.012, seamY + y])
const pedWide = real.pedestal.map(([hw, y]) => [hw * 1.1 + 0.02, y])
const plTop = rowOfM(plate.topY) - 14
const plBot = rowOfM(plate.bottomY) + 6
const plHalf = plate.half * pxPerUnit
const finTopPy = FINIAL_TOP_V * H - 14
const finBotPy = rowOfM(seamY + real.lid[real.lid.length - 1][1])
const svgM =
  `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="${W}" height="${H}" fill="black"/>` +
  polyM(real.body) +
  polyM(lidWide) +
  polyM(pedWide) +
  `<rect x="${(axPx - plHalf).toFixed(1)}" y="${plTop.toFixed(1)}" width="${(plHalf * 2).toFixed(1)}" height="${(plBot - plTop).toFixed(1)}" fill="white"/>` +
  `<rect x="${(axPx - 0.028 * W).toFixed(1)}" y="${finTopPy.toFixed(1)}" width="${(0.056 * W).toFixed(1)}" height="${(finBotPy - finTopPy).toFixed(1)}" fill="white"/>` +
  `</svg>`
const mRaw = await sharp(Buffer.from(svgM)).blur(11).raw().toBuffer()
const mCh = mRaw.length / (W * H)
const mask = new Uint8Array(W * H)
for (let p = 0; p < W * H; p++) mask[p] = mRaw[p * mCh] > 30 ? 1 : 0
for (let y = 0; y < H; y++) {
  let first = -1, last = -1
  for (let x = 0; x < W; x++)
    if (mask[y * W + x]) {
      if (first < 0) first = x
      last = x
    }
  if (first >= 0) for (let x = first; x <= last; x++) mask[y * W + x] = 1
}

// ---- compare ----
let maskN = 0, uncovered = 0, maxGapL = 0, maxGapR = 0, worstRow = -1
const vis = Buffer.alloc(W * H * 3)
const bg = await sharp('public/background.jpg').raw().toBuffer()
for (let y = 0; y < H; y++) {
  let gl = 0, gr = 0
  for (let x = 0; x < W; x++) {
    const p = y * W + x
    const i = p * 3
    vis[i] = bg[i]
    vis[i + 1] = bg[i + 1]
    vis[i + 2] = bg[i + 2]
    if (mask[p]) {
      maskN++
      if (!sil[p]) {
        uncovered++
        vis[i] = 255
        vis[i + 1] = 0
        vis[i + 2] = 0
        if (x < W / 2) gl++
        else gr++
      } else {
        vis[i] = Math.round(bg[i] * 0.4 + 60)
        vis[i + 1] = Math.round(bg[i + 1] * 0.4 + 160)
        vis[i + 2] = Math.round(bg[i + 2] * 0.4 + 60)
      }
    }
  }
  if (gl + gr > maxGapL + maxGapR) {
    maxGapL = gl
    maxGapR = gr
    worstRow = y
  }
}
await sharp(vis, { raw: { width: W, height: H, channels: 3 } })
  .resize(1200)
  .jpeg({ quality: 90 })
  .toFile(SP + 'coverage.jpg')
console.log(
  JSON.stringify(
    {
      ensembleScale: ENSEMBLE_SCALE,
      maskPixels: maskN,
      uncoveredPixels: uncovered,
      uncoveredPct: +((uncovered / maskN) * 100).toFixed(2),
      worstRow,
      worstRowFv: +(worstRow / H).toFixed(3),
      worstRowGapLeftPx: maxGapL,
      worstRowGapRightPx: maxGapR,
    },
    null,
    2,
  ),
)
