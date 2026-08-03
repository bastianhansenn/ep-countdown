// Builds a transparent cutout of the standing vase (no hand) from the
// white-wall photo, plus samples the exact glaze navy from the hand photo.
// Outputs: scripts/assets/vase-cutout.png (RGBA) and prints sampled colors.
// Run: node scripts/make-vase-cutout.mjs
import sharp from 'sharp'

// ---- 1. Sample the glaze navy from the daylight photo of the vase ----
const soloRaw = await sharp('scripts/assets/vase-solo.jpg')
  .rotate()
  .raw()
  .toBuffer({ resolveWithObject: true })

function samplePatch(x0, y0, size) {
  const { data, info } = soloRaw
  const vals = []
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) {
      const i = (y * info.width + x) * info.channels
      vals.push([data[i], data[i + 1], data[i + 2]])
    }
  }
  vals.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
  // 70th percentile: the glaze as it reads in daylight, not its darkest mottle.
  return vals[Math.floor(vals.length * 0.7)]
}

// Patches on the glaze around the belly, avoiding blossoms and highlights.
const patches = [
  samplePatch(2050, 2850, 60),
  samplePatch(2520, 3050, 60),
  samplePatch(2180, 3550, 60),
  samplePatch(2560, 3850, 60),
  samplePatch(2320, 2650, 60),
]
// The most blue-dominant patch is the clean glaze.
patches.sort((a, b) => b[2] - b[0] - (a[2] - a[0]))
const navy = patches[0]
const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
const lit = navy.map((v) => Math.min(255, Math.round(v * 1.45 + 14)))
console.log('glaze navy:', hex(navy), ' lit variant:', hex(lit))

// ---- 2. Cut the vase out of the white-wall photo ----
const { data, info } = await sharp('scripts/assets/vase-solo.jpg')
  .rotate()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const C = info.channels

// Vase bounding region measured by the texture-unwrap segmentation.
const X0 = 1720
const X1 = 2890
const Y0 = 1840
const Y1 = 4540
const CW = X1 - X0
const CH = Y1 - Y0

const px = (x, y) => {
  const i = (y * W + x) * C
  return [data[i], data[i + 1], data[i + 2]]
}

// Deterministic silhouette from the vase geometry that the texture-unwrap
// already calibrated against this exact photo: center column, pixels per
// profile unit, and the body/lid row ranges. The dog finial is irregular, so
// that small region falls back to a per-pixel color test.
const CX = 2301
const PX_PER_UNIT = 754.5
const ROWS_PER_UNIT = 820
const BODY_TOP = 2416
const BODY_BLUE_BOTTOM = 4368
const FOOT_BOTTOM = 4446
// The vase leans slightly left in the photo: the effective center drifts.
const centerAt = (y) => CX - ((y - 2191) / (FOOT_BOTTOM - 2191)) * 30
const LID_BASE = 2404
const LID_TOP = LID_BASE - Math.round(0.26 * ROWS_PER_UNIT)

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
function profileRadiusAt(profile, py) {
  for (let i = 1; i < profile.length; i++) {
    if (py <= profile[i][1]) {
      const [r0, p0] = profile[i - 1]
      const [r1, p1] = profile[i]
      const t = p1 === p0 ? 0 : (py - p0) / (p1 - p0)
      return r0 + (r1 - r0) * t
    }
  }
  return profile[profile.length - 1][0]
}

// Radius of the silhouette at an absolute photo row, 0 = outside the vase.
function radiusAt(y) {
  if (y >= BODY_TOP && y <= FOOT_BOTTOM) {
    const profY =
      y <= BODY_BLUE_BOTTOM
        ? 2.5 - ((y - BODY_TOP) / (BODY_BLUE_BOTTOM - BODY_TOP)) * 2.38
        : 0.12 * (1 - (y - BODY_BLUE_BOTTOM) / (FOOT_BOTTOM - BODY_BLUE_BOTTOM))
    return profileRadiusAt(BODY_PROFILE, Math.max(0, profY)) * PX_PER_UNIT * 0.995
  }
  if (y >= LID_TOP && y < BODY_TOP) {
    if (y >= LID_BASE) return 0.24 * PX_PER_UNIT // neck sliver under the brim
    const profY = ((LID_BASE - y) / ROWS_PER_UNIT)
    return profileRadiusAt(LID_PROFILE, Math.min(0.26, profY)) * PX_PER_UNIT * 1.01
  }
  return 0
}

// Finial (the dog): color-keyed inside a generous ellipse.
const FIN = { cx: 2246, cy: 2010, rx: 150, ry: 185 }
const isFinialPixel = (x, y) => {
  const dx = (x - FIN.cx) / FIN.rx
  const dy = (y - FIN.cy) / FIN.ry
  if (dx * dx + dy * dy > 1) return false
  const [r, g, b] = px(x, y)
  const mx = Math.max(r, g, b)
  const navy = b > 30 && b > r + 10 && b > g + 5 && mx < 190
  const porcelain = mx > 226 && b >= r - 6
  return navy || porcelain
}

const mask = Buffer.alloc(CW * CH)
for (let y = Y0; y < Y1; y++) {
  const row = (y - Y0) * CW
  const r = radiusAt(y)
  const cx = centerAt(y)
  if (r > 0) {
    const l = Math.max(X0, Math.round(cx - r))
    const rr = Math.min(X1 - 1, Math.round(cx + r))
    for (let x = l; x <= rr; x++) {
      const edge = Math.min(x - l, rr - x)
      mask[row + (x - X0)] = edge >= 3 ? 255 : Math.round(255 * (edge / 3))
    }
  }
  if (y >= FIN.cy - FIN.ry && y <= FIN.cy + FIN.ry) {
    // Fill between the outermost matching pixels so the dog has no holes.
    let first = -1
    let last = -1
    for (let x = FIN.cx - FIN.rx; x <= FIN.cx + FIN.rx; x++) {
      if (isFinialPixel(x, y)) {
        if (first === -1) first = x
        last = x
      }
    }
    if (first !== -1 && last - first < 350) {
      for (let x = first; x <= last; x++) mask[row + (x - X0)] = 255
    }
  }
}

// Refinement: the geometric silhouette is a hair generous in places, so trim
// wall (warm white) off the row edges and table wood off the bottom rows.
// Wall reads warm even in the vase's cast shadow; porcelain and glaze stay
// cool, so the warm test alone separates them.
const isWood = (x, y) => {
  const [r, g, b] = px(x, y)
  return r > b + 25 && r > 110
}
const isWall = (x, y) => {
  const [r, g, b] = px(x, y)
  return (r - b > 4 && r > 115) || isWood(x, y)
}
for (let y = Y0; y < Y1; y++) {
  const row = (y - Y0) * CW
  let l = -1
  let r = -1
  for (let x = 0; x < CW; x++) {
    if (mask[row + x] > 0) {
      if (l === -1) l = x
      r = x
    }
  }
  if (l === -1) continue
  // Trim contiguous table wood off the edges (wood is unambiguous).
  let trimmed = 0
  while (r > l && trimmed < 150 && isWood(X0 + r, y)) {
    mask[row + r] = 0
    r--
    trimmed++
  }
  trimmed = 0
  while (l < r && trimmed < 150 && isWood(X0 + l, y)) {
    mask[row + l] = 0
    l++
    trimmed++
  }
}

// Remaining sliver-sized imperfections along the contour are hidden by the
// die-cut white outline that the sticker compositions draw around the vase.
for (let y = Y1 - 1; y > Y1 - 160; y--) {
  const row = (y - Y0) * CW
  let woodCount = 0
  let total = 0
  for (let x = 0; x < CW; x++) {
    if (mask[row + x] > 0) {
      total++
      if (isWood(X0 + x, y)) woodCount++
    }
  }
  if (total > 0 && woodCount / total > 0.5) {
    for (let x = 0; x < CW; x++) mask[row + x] = 0
  }
}

// Assemble the RGBA buffer by hand: crop pixels plus the mask as alpha.
// No sharp channel operations involved, so nothing can reorder or mangle it.
const cropRgb = await sharp('scripts/assets/vase-solo.jpg')
  .rotate()
  .extract({ left: X0, top: Y0, width: CW, height: CH })
  .removeAlpha()
  .raw()
  .toBuffer()

const rgba = Buffer.alloc(CW * CH * 4)
for (let i = 0; i < CW * CH; i++) {
  rgba[i * 4] = cropRgb[i * 3]
  rgba[i * 4 + 1] = cropRgb[i * 3 + 1]
  rgba[i * 4 + 2] = cropRgb[i * 3 + 2]
  rgba[i * 4 + 3] = mask[i]
}

await sharp(rgba, { raw: { width: CW, height: CH, channels: 4 } })
  .png()
  .toFile('scripts/assets/vase-cutout.png')

const check = await sharp('scripts/assets/vase-cutout.png').metadata()
console.log(
  `wrote scripts/assets/vase-cutout.png ${CW}x${CH}, channels=${check.channels}, alpha=${check.hasAlpha}`,
)
