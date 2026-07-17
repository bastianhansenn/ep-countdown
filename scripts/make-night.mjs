// Bakes a real day-to-night conversion of public/background.jpg into
// public/background-night.jpg. Not a uniform dim:
//  - the sky is replaced with a dark night gradient
//  - shadows and midtones get a cool moonlit grade, highlights keep sheen
//  - depth of field: the deeper into the street (toward the vanishing
//    point), the blurrier the image
//  - a realistic moon (maria, limb darkening, crisp edge, no halo) is drawn
//    last so it stays sharp
// Run: node scripts/make-night.mjs
import sharp from 'sharp'

const SRC = 'public/background.jpg'
const OUT = 'public/background-night.jpg'
const TARGET_W = 1920 // upscale so the moon and fine grades render crisply

const base = sharp(SRC).resize({ width: TARGET_W, kernel: 'lanczos3' })
const { data, info } = await base
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

const clamp255 = (v) => Math.max(0, Math.min(255, v))
const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const lerp = (a, b, t) => a + (b - a) * t

// ---- Pass 1: night grade (no moon yet), remember the sky weight ----
const skyW = new Float32Array(W * H)

for (let y = 0; y < H; y++) {
  const fy = y / H
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const maxc = Math.max(r, g, b)
    const minc = Math.min(r, g, b)
    const sat = maxc === 0 ? 0 : (maxc - minc) / maxc

    const wSky =
      smoothstep(160, 210, L) *
      (1 - smoothstep(0.16, 0.34, sat)) *
      (1 - smoothstep(0.52, 0.72, fy))
    skyW[y * W + x] = wSky

    const dr = lerp(L, r, 0.35) / 255
    const dg = lerp(L, g, 0.35) / 255
    const db = lerp(L, b, 0.35) / 255
    let nr = Math.pow(dr, 1.42) * 0.5 * 0.55 * 255 * 1.9
    let ng = Math.pow(dg, 1.42) * 0.6 * 0.55 * 255 * 1.9
    let nb = Math.pow(db, 1.42) * 0.95 * 0.55 * 255 * 1.9

    const shadowLift = 1 - smoothstep(0, 90, L)
    nr += 4 * shadowLift
    ng += 7 * shadowLift
    nb += 16 * shadowLift

    const wWet = smoothstep(150, 225, L) * smoothstep(0.52, 0.75, fy) * 0.5
    nr += 24 * wWet
    ng += 34 * wWet
    nb += 62 * wWet

    const cloud = (L - 190) * 0.1
    const skyR = lerp(7, 16, fy * 2.2) + cloud * 0.4
    const skyG = lerp(11, 24, fy * 2.2) + cloud * 0.6
    const skyB = lerp(26, 48, fy * 2.2) + cloud

    data[i] = clamp255(lerp(nr, skyR, wSky))
    data[i + 1] = clamp255(lerp(ng, skyG, wSky))
    data[i + 2] = clamp255(lerp(nb, skyB, wSky))
    data[i + 3] = 255
  }
}

// ---- Pass 2: depth of field toward the vanishing point ----
const raw = { raw: { width: W, height: H, channels: 4 } }
const levels = [data]
for (const sigma of [2.2, 5.5, 10]) {
  const { data: blurred } = await sharp(data, raw)
    .blur(sigma)
    .raw()
    .toBuffer({ resolveWithObject: true })
  levels.push(blurred)
}

const vpX = 0.5 * W
const vpY = 0.47 * H
const maxDist = Math.hypot(W * 0.5, H * 0.53)
const out = Buffer.alloc(W * H * 4)

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const dn = Math.hypot(x - vpX, y - vpY) / maxDist
    // 1 near the vanishing point (deep, blurry), 0 at the frame edges.
    const tVp = 1 - smoothstep(0.08, 0.62, dn)
    // The sky is always distant, so it gets a base blur as well.
    const t = Math.max(tVp, skyW[y * W + x] * 0.55)

    const level = t * (levels.length - 1)
    const i0 = Math.min(levels.length - 2, Math.floor(level))
    const frac = level - i0
    for (let c = 0; c < 3; c++) {
      out[i + c] = clamp255(
        lerp(levels[i0][i + c], levels[i0 + 1][i + c], frac),
      )
    }
    out[i + 3] = 255
  }
}

// ---- Pass 3: composite the real moon photo (scripts/assets/moon.jpg),
// after the blur so it stays sharp. Screen blending makes its black
// background vanish against the night sky. ----
const moonX = 0.62 * W
const moonY = 0.14 * H
const MOON_DIAMETER = Math.round(0.06 * W)

const probe = await sharp('scripts/assets/moon.jpg')
  .raw()
  .toBuffer({ resolveWithObject: true })
const mW = probe.info.width
const mH = probe.info.height
const mC = probe.info.channels
let mx0 = mW
let mx1 = 0
let my0 = mH
let my1 = 0
for (let y = 0; y < mH; y++) {
  for (let x = 0; x < mW; x++) {
    const i = (y * mW + x) * mC
    const L =
      0.2126 * probe.data[i] +
      0.7152 * probe.data[i + 1] +
      0.0722 * probe.data[i + 2]
    if (L > 25) {
      if (x < mx0) mx0 = x
      if (x > mx1) mx1 = x
      if (y < my0) my0 = y
      if (y > my1) my1 = y
    }
  }
}

const { data: moon, info: moonInfo } = await sharp('scripts/assets/moon.jpg')
  .extract({ left: mx0, top: my0, width: mx1 - mx0 + 1, height: my1 - my0 + 1 })
  .resize({
    width: MOON_DIAMETER,
    height: MOON_DIAMETER,
    fit: 'fill',
    kernel: 'lanczos3',
  })
  .raw()
  .toBuffer({ resolveWithObject: true })

const left = Math.round(moonX - MOON_DIAMETER / 2)
const top = Math.round(moonY - MOON_DIAMETER / 2)
for (let y = 0; y < MOON_DIAMETER; y++) {
  const ty = top + y
  if (ty < 0 || ty >= H) continue
  for (let x = 0; x < MOON_DIAMETER; x++) {
    const tx = left + x
    if (tx < 0 || tx >= W) continue
    const si = (y * MOON_DIAMETER + x) * moonInfo.channels
    const di = (ty * W + tx) * 4
    for (let c = 0; c < 3; c++) {
      const bg = out[di + c]
      const fg = moon[si + c]
      out[di + c] = 255 - ((255 - bg) * (255 - fg)) / 255
    }
  }
}

await sharp(out, raw)
  .flatten({ background: '#000000' })
  .jpeg({ quality: 92 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${W}x${H})`)
