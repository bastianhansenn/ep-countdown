// Bakes the professional street photo (real vase on the real pedestal) into
// its night version for the site. The photo already carries natural depth of
// field, so this is purely a grade: cool moonlit conversion, deeper shadows,
// the pale sky replaced with a dark night gradient.
// Source: scripts/assets/street-pro.jpg -> public/background-night.jpg
// Run: node scripts/make-night.mjs
import sharp from 'sharp'

const SRC = 'scripts/assets/street-pro.jpg'
const OUT = 'public/background-night.jpg'
const TARGET_W = 2400

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
// Smooth the horizon: median for spike removal, then a box blur.
const med = Float32Array.from(horizon)
for (let x = 4; x < W - 4; x++) {
  const win = []
  for (let k = -4; k <= 4; k++) win.push(horizon[x + k])
  win.sort((a, b) => a - b)
  med[x] = win[4]
}
for (let pass = 0; pass < 2; pass++) {
  for (let x = 8; x < W - 8; x++) {
    let sum = 0
    for (let k = -8; k <= 8; k++) sum += med[x + k]
    med[x] = sum / 17
  }
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

    // Full sky above the horizon, feathering a few pixels into the roofs so
    // the bright bokeh transition is swallowed by the night sky.
    const wSky = 1 - smoothstep(med[x] - 16, med[x] + 5, y)

    // Moonlit grade: desaturate toward luminance, darken through a tone
    // curve, bias toward blue; shadows fall deeper than highlights.
    const dr = lerp(L, r, 0.32) / 255
    const dg = lerp(L, g, 0.32) / 255
    const db = lerp(L, b, 0.32) / 255
    let nr = Math.pow(dr, 1.5) * 0.48 * 255
    let ng = Math.pow(dg, 1.5) * 0.58 * 255
    let nb = Math.pow(db, 1.5) * 0.94 * 255

    const shadowLift = 1 - smoothstep(0, 90, L)
    nr += 4 * shadowLift
    ng += 7 * shadowLift
    nb += 16 * shadowLift

    // Cold sheen on the brightest cobbles in the foreground.
    const wWet = smoothstep(165, 235, L) * smoothstep(0.55, 0.8, fy) * 0.45
    nr += 22 * wWet
    ng += 30 * wWet
    nb += 56 * wWet

    // Night sky gradient with a whisper of the original cloud texture.
    const cloud = (L - 200) * 0.08
    const skyR = lerp(7, 15, fy * 3) + cloud * 0.4
    const skyG = lerp(11, 23, fy * 3) + cloud * 0.6
    const skyB = lerp(26, 46, fy * 3) + cloud

    data[i] = clamp255(lerp(nr, skyR, wSky))
    data[i + 1] = clamp255(lerp(ng, skyG, wSky))
    data[i + 2] = clamp255(lerp(nb, skyB, wSky))
    data[i + 3] = 255
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .flatten({ background: '#000000' })
  .jpeg({ quality: 86 })
  .toFile(OUT)

console.log(`wrote ${OUT} (${W}x${H})`)
