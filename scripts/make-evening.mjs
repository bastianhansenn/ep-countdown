// Bakes the pro street photo into the site background:
// 1. Trims 57px off the left edge so the vase axis (x = 0.5067 of the
//    original, confirmed by the pedestal ball centroid) sits at exactly 50%.
// 2. Grades it to EVENING: the sky a bit darker with a dusk blue-gray cast,
//    the rest gently dropped in exposure. Colors stay overwhelmingly the
//    photo's own so it never reads as a filter.
// 3. Cuts the lid out of the graded image as a feathered sprite for the
//    subtle on-page vibration.
// Source: scripts/assets/street-pro.jpg
// Output: public/background.jpg + public/evening-lid.png
// Run: node scripts/make-evening.mjs
import sharp from 'sharp'

const SRC = 'scripts/assets/street-pro.jpg'
const OUT = 'public/background.jpg'
const OUT_LID = 'public/evening-lid.png'
const TRIM_LEFT = 57
const TARGET_W = 3600

const src = sharp(SRC)
const meta = await src.metadata()
const { data, info } = await src
  .extract({ left: TRIM_LEFT, top: 0, width: meta.width - TRIM_LEFT, height: meta.height })
  .resize({ width: TARGET_W, kernel: 'lanczos3' })
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

// ---- Pass 1: horizon line per column (walk down while it reads as pale
// sky), median-smoothed just enough to kill single-column spikes. ----
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
const med = Float32Array.from(horizon)
for (let x = 2; x < W - 2; x++) {
  const win = []
  for (let k = -2; k <= 2; k++) win.push(horizon[x + k])
  win.sort((a, b) => a - b)
  med[x] = win[2]
}

// How far below the horizon line each column stays BRIGHT: on heavily
// bokeh'd rooflines the walk stops at the top of a wide soft blend, and the
// bright part of that blend must dim with the sky (otherwise it stays as a
// faint light rim tracing the silhouette). Dark cores stop the fall at once.
const lumAt = (x, y) => {
  const i = (y * W + x) * 4
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
}
const fall = new Float32Array(W)
const FALL_CAP = Math.round(H * 0.035)
for (let x = 0; x < W; x++) {
  let d = 0
  const y0 = Math.round(med[x])
  while (d < FALL_CAP && y0 + d < H && lumAt(x, y0 + d) > 135) d++
  fall[x] = d
}
const fallMed = Float32Array.from(fall)
for (let x = 2; x < W - 2; x++) {
  const win = []
  for (let k = -2; k <= 2; k++) win.push(fall[x + k])
  win.sort((a, b) => a - b)
  fallMed[x] = win[2]
}

// Vase silhouette (axis at x = 0.5 after the trim): half-width as a function
// of height, traced from the photo. Only needed down to 0.52H because the
// tonal band is zero below 0.5H anyway.
const VASE_PROFILE = [
  [0.288, 0.006], [0.305, 0.013], [0.322, 0.011], [0.338, 0.028],
  [0.352, 0.0405], [0.377, 0.0405], [0.386, 0.023], [0.405, 0.0235],
  [0.43, 0.028], [0.47, 0.0345], [0.52, 0.0375],
]
const vaseHalfWidth = (fy) => {
  if (fy <= VASE_PROFILE[0][0]) return 0
  if (fy >= VASE_PROFILE[VASE_PROFILE.length - 1][0]) return 0.0375
  for (let k = 1; k < VASE_PROFILE.length; k++) {
    const [y1, r1] = VASE_PROFILE[k - 1]
    const [y2, r2] = VASE_PROFILE[k]
    if (fy <= y2) return lerp(r1, r2, (fy - y1) / (y2 - y1))
  }
  return 0
}

// ---- Pass 2: evening grade ----
for (let y = 0; y < H; y++) {
  const fy = y / H
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b

    // Sky weight: everything above the horizon line, PLUS a tonal term that
    // catches the pale bokeh blend hugging the rooflines and the bright
    // distant gables just below the line (both are sky-lit and must dim with
    // the sky, otherwise they stay behind as bright halos with hard edges).
    const maxc = Math.max(r, g, b)
    const minc = Math.min(r, g, b)
    const sat = maxc === 0 ? 0 : (maxc - minc) / maxc
    // The tight line feather keeps dark roof edges free of blue lift; the
    // tonal term catches every pale pixel in the upper half (bokeh fringes
    // hugging the rooflines, sky pockets behind chimneys) with a GLOBAL
    // vertical falloff, so adjacent columns can never disagree into seams.
    // The sat gate is loose enough for sky-brick blends; the in-focus vase
    // is explicitly protected so its white porcelain stays bright.
    const skyLike = smoothstep(100, 168, L) * (1 - smoothstep(0.25, 0.45, sat))
    const band = 1 - smoothstep(H * 0.35, H * 0.5, y)
    const vr = vaseHalfWidth(fy) * W
    const vdx = Math.abs(x - 0.5 * W)
    const protect = vr > 0 ? 1 - smoothstep(vr - 2, vr + 6, vdx) : 0
    const wSky = Math.max(
      1 - smoothstep(med[x] - 5, med[x] + fallMed[x] + 2, y),
      skyLike * band * (1 - protect),
    )

    // Ground: a gentler exposure (about -1 stop with a soft toe), keeping
    // 88% of the photo's own color and a whisper of cool white balance.
    const t = L / 255
    const darkT = Math.pow(t, 1.1) * 0.74
    const scaleL = darkT / Math.max(t, 0.004)
    const gray = darkT * 255
    const gr = lerp(gray, r * scaleL, 0.88) * 0.975
    const gg = lerp(gray, g * scaleL, 0.88) * 0.99
    const gb = lerp(gray, b * scaleL, 0.88) * 1.045

    // Sky: the photo's own sky darkened (more at the top of the frame,
    // lighter residue toward the horizon) and pulled toward dusk blue-gray.
    // Clamped so the sky treatment can only ever darken (a dark roof pixel
    // caught by the feather must never be lifted into a glowing rim).
    const f = lerp(0.42, 0.58, Math.min(1, fy * 2.4))
    const sr = Math.min(lerp(r * f, 90, 0.3), gr)
    const sg = Math.min(lerp(g * f, 104, 0.3), gg)
    const sb = Math.min(lerp(b * f, 142, 0.3), gb)

    let fr = clamp255(lerp(gr, sr, wSky))
    let fg = clamp255(lerp(gg, sg, wSky))
    let fb = clamp255(lerp(gb, sb, wSky))

    // The photo carries strong cyan fringing along the bokeh silhouettes;
    // against the muted evening sky it reads as a glowing rim. Cap the
    // chroma of sky-weighted pixels so edge blends stay as neutral as the
    // sky around them.
    if (wSky > 0.05) {
      const chroma = Math.max(fr, fg, fb) - Math.min(fr, fg, fb)
      if (chroma > 20) {
        const Lf = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb
        const factor = lerp(1, 20 / chroma, wSky)
        fr = Lf + (fr - Lf) * factor
        fg = Lf + (fg - Lf) * factor
        fb = Lf + (fb - Lf) * factor
      }
    }

    data[i] = clamp255(fr)
    data[i + 1] = clamp255(fg)
    data[i + 2] = clamp255(fb)
    data[i + 3] = 255
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .flatten({ background: '#000000' })
  .jpeg({ quality: 88 })
  .toFile(OUT)
console.log(`wrote ${OUT} (${W}x${H})`)

// ---- Lid sprite from the SAME graded pixels (box in trimmed coords, must
// match LID in src/components/Stage.tsx). ----
const LID = { x0: 0.4608, x1: 0.5408, y0: 0.327, y1: 0.393 }
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
