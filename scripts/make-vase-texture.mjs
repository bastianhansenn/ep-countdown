// Unwraps the real vase photo (Downloads/IMG_5437.jpeg) into cylindrical
// textures for the 3D lathe meshes, so the site shows the actual vase and
// not a painted imitation.
//
// How: the vase is auto-segmented from the photo by its navy glaze; per row
// the silhouette half-width R(y) is measured. Each texture column samples the
// photo at x = cx + sin(angle) * R(y), i.e. the photo's front half is bent
// around the lathe and mirrored onto the back, which keeps the texture
// seamless. Body and lid are unwrapped separately for their two meshes.
// Run: node scripts/make-vase-texture.mjs
import sharp from 'sharp'

const SRC = 'C:/Users/basti/Downloads/IMG_5437.jpeg'
const OUT_BODY = 'public/vase-body.png'
const OUT_LID = 'public/vase-lid.png'
const BODY_SIZE = 2048
const LID_SIZE = 1024

// Must match src/lib/vaseProfiles.ts. Used to extend the silhouette through
// the white foot (unmeasurable against the white wall) and to shape the lid.
const BODY_PROFILE = [
  [0.42, 0.0], [0.44, 0.05], [0.38, 0.12], [0.35, 0.22], [0.36, 0.4],
  [0.42, 0.62], [0.5, 0.85], [0.58, 1.08], [0.64, 1.32], [0.66, 1.55],
  [0.63, 1.78], [0.55, 1.98], [0.4, 2.15], [0.28, 2.28], [0.24, 2.38],
  [0.24, 2.5],
]
const LID_PROFILE = [
  [0.0, 0.0], [0.24, 0.0], [0.4, 0.01], [0.44, 0.045], [0.4, 0.08],
  [0.3, 0.13], [0.2, 0.19], [0.1, 0.235], [0.055, 0.26],
]
const BODY_TOP_Y = 2.5
const BODY_BLUE_BOTTOM_Y = 0.12 // below this the foot is white in the photo
const LID_TOP_Y = 0.26

function profileRadiusAt(profile, y) {
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

// .rotate() applies the photo's EXIF orientation (portrait). Full source
// resolution: the unwrap downsamples from here, so the texture stays sharp.
const img = sharp(SRC).rotate()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const C = info.channels

const px = (x, y) => {
  const i = (y * W + x) * C
  return [data[i], data[i + 1], data[i + 2]]
}
// Navy-glaze test tuned against the debug overlay: catches both the lit and
// the deeply shadowed side of the glaze. The bright white wall fails the
// brightness cap, and near-black cast shadows need extra blue dominance so
// they cannot pass.
const isBlue = (r, g, b) => {
  const mx = Math.max(r, g, b)
  if (mx >= 180 || b <= 30) return false
  if (mx < 80) return b > r + 18 && b > g + 8
  return b > r + 10 && b > g + 5
}
// Oak table detection, used to pull samples back inside the silhouette.
const isWood = (r, g, b) => r > b + 25 && r > 110

// Per-row blue silhouette span.
const spans = new Array(H).fill(null)
for (let y = 0; y < H; y++) {
  let left = -1
  let right = -1
  let count = 0
  for (let x = 0; x < W; x++) {
    const [r, g, b] = px(x, y)
    if (isBlue(r, g, b)) {
      if (left === -1) left = x
      right = x
      count++
    }
  }
  // Demand a reasonably solid navy run so stray dark pixels cannot form a
  // fake span. Kept permissive: rows where white blossoms cover much of the
  // width still count.
  if (left !== -1 && right - left > 30 && count > (right - left) * 0.18) {
    spans[y] = { left, right }
  }
}

// The body is the longest run of rows with a meaningful span, tolerating
// gaps of up to 60 rows (rows where blossoms cover most of the width can
// fail the span test without splitting the body in two).
const good = []
for (let y = 0; y < H; y++) {
  if (spans[y] !== null && spans[y].right - spans[y].left > 40) good.push(y)
}
let best = { start: good[0], end: good[0] }
let s0 = good[0]
let prev = good[0]
for (const y of good.slice(1)) {
  if (y - prev > 60) {
    if (prev - s0 > best.end - best.start) best = { start: s0, end: prev }
    s0 = y
  }
  prev = y
}
if (prev - s0 > best.end - best.start) best = { start: s0, end: prev }

// The gap merge can pull the navy lid dome into the run (the white brim band
// between lid and mouth is a small hole). Inside the top 30% of the run, a
// hole of 20+ rows IS the brim: the body starts below the last such hole.
const topSlice = good.filter(
  (y) => y >= best.start && y <= best.start + (best.end - best.start) * 0.3,
)
for (let i = 1; i < topSlice.length; i++) {
  if (topSlice[i] - topSlice[i - 1] >= 20) best.start = topSlice[i]
}

const bodyTopRow = best.start
const bodyBlueBottomRow = best.end
const bodyBlueRows = bodyBlueBottomRow - bodyTopRow

// Photo rows per profile unit, from the blue region we can measure.
const rowsPerUnit = bodyBlueRows / (BODY_TOP_Y - BODY_BLUE_BOTTOM_Y)
const footBottomRow = Math.min(
  H - 1,
  Math.round(bodyBlueBottomRow + BODY_BLUE_BOTTOM_Y * rowsPerUnit),
)

// Centerline and smoothed measured radii.
const mids = []
for (let y = bodyTopRow; y <= bodyBlueBottomRow; y++) {
  if (spans[y]) mids.push((spans[y].left + spans[y].right) / 2)
}
mids.sort((a, b) => a - b)
const cx = mids[Math.floor(mids.length / 2)]

// R(y) = smoothed measured silhouette half-width. Rows where blossoms touch
// the edge under-measure a little; heavy smoothing plus the inward sampling
// margin absorbs that, and it can never place samples on the wall or table.
const radii = new Float32Array(H)
for (let y = bodyTopRow; y <= bodyBlueBottomRow; y++) {
  radii[y] = spans[y] ? (spans[y].right - spans[y].left) / 2 : radii[y - 1] || 0
}
let maxR = 0
for (let y = bodyTopRow; y <= bodyBlueBottomRow; y++) maxR = Math.max(maxR, radii[y])
const pxPerUnit = maxR / 0.66
// The white foot is unmeasurable against the white wall: take its radius
// from the known profile, anchored to the measured scale.
for (let y = bodyBlueBottomRow + 1; y <= footBottomRow; y++) {
  const t = (y - bodyBlueBottomRow) / Math.max(1, footBottomRow - bodyBlueBottomRow)
  radii[y] = profileRadiusAt(BODY_PROFILE, BODY_BLUE_BOTTOM_Y * (1 - t)) * pxPerUnit
}
// Smooth hard: 5 passes of a 31-row box filter over the whole range, but
// never let smoothing inflate a row much past its measured width (at the
// steep neck taper, averaging with the wide shoulder below would otherwise
// push samples onto the wall).
const measuredCap = Float32Array.from(radii)
for (let pass = 0; pass < 5; pass++) {
  const copy = Float32Array.from(radii)
  for (let y = bodyTopRow; y <= footBottomRow; y++) {
    let sum = 0
    let n = 0
    for (let k = -15; k <= 15; k++) {
      const yy = y + k
      if (yy >= bodyTopRow && yy <= footBottomRow) {
        sum += copy[yy]
        n++
      }
    }
    radii[y] = sum / n
    if (measuredCap[y] > 0) {
      radii[y] = Math.min(radii[y], measuredCap[y] * 1.08 + 4)
    }
  }
}

const sample = (fx, fy) => {
  const xi = Math.max(0, Math.min(W - 1, Math.round(fx)))
  const yi = Math.max(0, Math.min(H - 1, Math.round(fy)))
  return px(xi, yi)
}

// Compress the photo's baked window reflections so a rotating hard-white
// specular blob does not travel with the glaze.
const softenSpecular = ([r, g, b]) => {
  const mn = Math.min(r, g, b)
  if (mn > 205) {
    const c = (v) => Math.round(205 + (v - 205) * 0.4)
    return [c(r), c(g), c(b)]
  }
  return [r, g, b]
}

// Sample at cx + s * R, pulling inward if the sample lands on the table.
const sampleOnVase = (s, R, fy) => {
  let scale = 0.96
  for (let step = 0; step < 6; step++) {
    const [r, g, b] = sample(cx + s * R * scale, fy)
    if (!isWood(r, g, b)) return softenSpecular([r, g, b])
    scale -= 0.07
  }
  return softenSpecular(sample(cx, fy))
}

function unwrap(size, rowAt, radiusAt) {
  const out = Buffer.alloc(size * size * 3)
  for (let ty = 0; ty < size; ty++) {
    // Texture v=1 is the top; PNG row 0 is also the top (flipY handles it).
    const v = 1 - ty / size
    const fy = rowAt(v)
    const R = radiusAt(v, fy)
    for (let tx = 0; tx < size; tx++) {
      // Two mirrored panels around the circumference instead of a sin()
      // projection: offset is LINEAR in the angle, so the photo's edge
      // columns are never smeared into streaks, and front and back look
      // identical. Panel seams are mirror joints, i.e. perfectly continuous.
      const u = tx / size
      const f = (u * 2 + 0.25) % 1
      const tri = f < 0.5 ? f * 2 : 2 - f * 2
      const s = (tri * 2 - 1) * 0.87
      const [r, g, b] = sampleOnVase(s, R, fy)
      const i = (ty * size + tx) * 3
      out[i] = r
      out[i + 1] = g
      out[i + 2] = b
    }
  }
  return out
}

// Clamp the bottom to the last row that is porcelain across its width (not
// just at the centerline), so no texture row can contain table wood.
const rowTouchesWood = (y) => {
  const R = radii[Math.min(footBottomRow, y)]
  for (const s of [-0.9, -0.45, 0, 0.45, 0.9]) {
    const x = Math.max(0, Math.min(W - 1, Math.round(cx + s * R * 0.96)))
    if (isWood(...px(x, y))) return true
  }
  return false
}
let bottomRow = footBottomRow
while (bottomRow > bodyBlueBottomRow && rowTouchesWood(bottomRow)) {
  bottomRow--
}

// Body: v=0 at the foot bottom, v=1 at the mouth rim.
const bodyPixels = unwrap(
  BODY_SIZE,
  (v) => bottomRow - v * (bottomRow - bodyTopRow),
  (v, fy) => radii[Math.max(bodyTopRow, Math.min(footBottomRow, Math.round(fy)))],
)
// Contrast S-push plus unsharp mask so the pattern reads crisply even at
// small on-screen sizes.
await sharp(bodyPixels, { raw: { width: BODY_SIZE, height: BODY_SIZE, channels: 3 } })
  .linear(1.16, -12)
  .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.6 })
  .png()
  .toFile(OUT_BODY)

// Lid: rows above the body, shaped by the lid profile.
const lidRows = Math.round(LID_TOP_Y * rowsPerUnit)
const lidBottomRow = bodyTopRow - Math.round(0.015 * rowsPerUnit)
const lidPixels = unwrap(
  LID_SIZE,
  (v) => lidBottomRow - v * lidRows,
  (v) => profileRadiusAt(LID_PROFILE, v * LID_TOP_Y) * pxPerUnit,
)
await sharp(lidPixels, { raw: { width: LID_SIZE, height: LID_SIZE, channels: 3 } })
  .linear(1.16, -12)
  .sharpen({ sigma: 1.2, m1: 1.0, m2: 0.6 })
  .png()
  .toFile(OUT_LID)

console.log(
  `body rows ${bodyTopRow}-${bodyBlueBottomRow} (foot to ${footBottomRow}), cx ${Math.round(cx)}, maxR ${Math.round(maxR)}px -> ${OUT_BODY}, ${OUT_LID}`,
)
