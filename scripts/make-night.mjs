// Bakes the professional street photo (real vase on the real pedestal) into
// its night version for the site. The photo already carries natural depth of
// field, so this is purely a grade: cool moonlit conversion, deeper shadows,
// the pale sky replaced with a dark night gradient.
// Source: scripts/assets/street-pro.jpg -> public/background-night.jpg
// Run: node scripts/make-night.mjs
import sharp from 'sharp'

const SRC = 'scripts/assets/street-pro.jpg'
const OUT = 'public/background-night.jpg'
const OUT_LID = 'public/night-lid.png'
const TARGET_W = 3600

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

// ---- Pass 1: find the horizon line per column. Tonal masks cannot handle
// the soft bokeh roof edges, so instead: walk each column from the top while
// the pixels still read as pale sky; everything above that row IS sky. ----
const isSkyPixel = (x, y) => {
  const i = (y * W + x) * 4
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const maxc = Math.max(r, g, b)
  const minc = Math.min(r, g, b)
  const sat = maxc === 0 ? 0 : (maxc - minc) / maxc
  return L > 165 && sat < 0.22
}
const horizon = new Float32Array(W)
for (let x = 0; x < W; x++) {
  let y = 0
  let miss = 0
  while (y < H * 0.6) {
    if (isSkyPixel(x, y)) {
      miss = 0
    } else {
      miss++
      if (miss > 8) break
    }
    y++
  }
  horizon[x] = Math.max(0, y - miss)
}
// Only a small median: enough to kill single-column spikes while keeping
// the roof corners sharp (heavier smoothing melts gables and chimneys).
const med = Float32Array.from(horizon)
for (let x = 2; x < W - 2; x++) {
  const win = []
  for (let k = -2; k <= 2; k++) win.push(horizon[x + k])
  win.sort((a, b) => a - b)
  med[x] = win[2]
}

// ---- Pass 2: grade ----
for (let y = 0; y < H; y++) {
  const fy = y / H
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b

    // Full sky above the horizon with a tight feather: the photo's own
    // bokeh already softens the rooflines, so a crisp junction looks real.
    const wSky = 1 - smoothstep(med[x] - 5, med[x] + 2, y)

    // Night grade that keeps the photograph intact: scale each pixel's
    // channels by a luminance-preserving ratio (a darker exposure with an
    // S-curve for contrast), keep most of the original color, then shift
    // the white balance coolly. No channel remapping = no plastic filter.
    const t = L / 255
    let darkT = Math.pow(t, 1.35) * 0.5
    darkT = Math.max(0, 0.2 + (darkT - 0.2) * 1.18) // contrast around the mids
    const scaleL = darkT / Math.max(t, 0.004)
    const gray = darkT * 255
    let nr = lerp(gray, r * scaleL, 0.68) * 0.85
    let ng = lerp(gray, g * scaleL, 0.68) * 0.93
    let nb = lerp(gray, b * scaleL, 0.68) * 1.16

    // Faint blue air in the deepest shadows.
    const shadowLift = 1 - smoothstep(0, 80, L)
    nr += 2 * shadowLift
    ng += 4 * shadowLift
    nb += 10 * shadowLift

    // Night sky gradient with a whisper of the original cloud texture.
    const cloud = (L - 200) * 0.06
    const skyR = lerp(9, 20, fy * 3) + cloud * 0.4
    const skyG = lerp(13, 29, fy * 3) + cloud * 0.6
    const skyB = lerp(30, 56, fy * 3) + cloud

    data[i] = clamp255(lerp(nr, skyR, wSky))
    data[i + 1] = clamp255(lerp(ng, skyG, wSky))
    data[i + 2] = clamp255(lerp(nb, skyB, wSky))
    data[i + 3] = 255
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .flatten({ background: '#000000' })
  .jpeg({ quality: 88 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${W}x${H})`)

// ---- Lid sprite: the photographed lid cut from the SAME night image, with
// feathered edges, so the site can vibrate it on top of the still photo. ----
const LID = { x0: 0.468, x1: 0.547, y0: 0.327, y1: 0.393 }
const lx = Math.round(LID.x0 * W)
const ly = Math.round(LID.y0 * H)
const lw = Math.round((LID.x1 - LID.x0) * W)
const lh = Math.round((LID.y1 - LID.y0) * H)
const FEATHER = Math.round(lw * 0.06)

const lidRgba = Buffer.alloc(lw * lh * 4)
for (let y = 0; y < lh; y++) {
  for (let x = 0; x < lw; x++) {
    const si = ((ly + y) * W + (lx + x)) * 4
    const di = (y * lw + x) * 4
    lidRgba[di] = data[si]
    lidRgba[di + 1] = data[si + 1]
    lidRgba[di + 2] = data[si + 2]
    const edge = Math.min(x, lw - 1 - x, y, lh - 1 - y)
    lidRgba[di + 3] = Math.round(255 * Math.min(1, edge / FEATHER))
  }
}
await sharp(lidRgba, { raw: { width: lw, height: lh, channels: 4 } })
  .png()
  .toFile(OUT_LID)
console.log(`wrote ${OUT_LID} (${lw}x${lh}) box`, LID)
