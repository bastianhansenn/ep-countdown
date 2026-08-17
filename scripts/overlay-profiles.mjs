// Draws the traced profiles (mirrored around the axis) over the photo so the
// silhouette match can be eyeballed. Green = vase body, cyan = lid, magenta
// = pedestal. Out: scratchpad/overlay.jpg
import sharp from 'sharp'
import real from '../src/lib/realProfiles.json' with { type: 'json' }

const SRC = 'public/background.jpg'
const meta = await sharp(SRC).metadata()
const W = meta.width
const H = meta.height
const { AXIS, FINIAL_TOP_V, FOOT_BOTTOM_V, MODEL_H, seamY } = real.meta
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
const footPy = FOOT_BOTTOM_V * H
const axPx = AXIS * W
// model y -> photo row
const rowOf = (yModel) => footPy - yModel * pxPerUnit
const xOf = (half, sign) => axPx + sign * half * pxPerUnit

const poly = (pts, color) => {
  const up = pts.map(([hw, y]) => `${xOf(hw, 1).toFixed(1)},${rowOf(y).toFixed(1)}`)
  const down = pts.map(([hw, y]) => `${xOf(hw, -1).toFixed(1)},${rowOf(y).toFixed(1)}`).reverse()
  return `<polyline points="${[...up, ...down].join(' ')}" fill="none" stroke="${color}" stroke-width="4"/>`
}
// lid points are local to the seam; shift up by seamY
const lidPts = real.lid.map(([hw, y]) => [hw, real.meta.seamY + y])
let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`
svg += poly(real.body, '#00ff66')
svg += poly(lidPts, '#00e5ff')
svg += poly(real.pedestal, '#ff3df0')
svg += `<line x1="${axPx}" y1="0" x2="${axPx}" y2="${H}" stroke="yellow" stroke-width="1" opacity="0.5"/>`
svg += `</svg>`
const OUT =
  'C:/Users/basti/AppData/Local/Temp/claude/C--Users-basti-OneDrive-Documents-GitHub-ProReach/84e84cf5-8c45-435b-b3ec-b99ae747f174/scratchpad/overlay.jpg'
await sharp(SRC).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 92 }).toFile(OUT)
console.log('wrote overlay')
