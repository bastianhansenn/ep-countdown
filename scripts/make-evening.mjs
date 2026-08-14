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
  // White porcelain reads as sky, so in the vase's columns the walk is
  // capped just above the finial: otherwise it marches THROUGH the white
  // lid and mislabels everything above as sky in exactly those columns.
  const limit = Math.abs(x - 0.5 * W) < 0.045 * W ? H * 0.283 : H * 0.6
  let y = 0
  let miss = 0
  while (y < limit) {
    if (isSkyPixel(x, y)) {
      miss = 0
    } else {
      miss++
      if (miss > 8) break
    }
    y++
  }
  horizon[x] = Math.max(0, Math.min(y - miss, limit))
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

// Vase protection mask, built from SHARPNESS: the vase is the only in-focus
// subject, so strong local gradients trace exactly its silhouette and glaze
// pattern (an analytic width profile leaves bright rectangles wherever it
// misses the real outline). A morphological close (dilate then erode) fills
// the smooth white glaze between pattern edges; a soft blur feathers it.
// Only needed where the tonal band is nonzero (upper half around the axis).
const MX0 = Math.round(W * (0.5 - 0.055))
const MX1 = Math.round(W * (0.5 + 0.055))
const MY0 = Math.round(H * 0.27)
const MY1 = Math.round(H * 0.56)
const mw = MX1 - MX0
const mh = MY1 - MY0
{
  const grid = new Float32Array(mw * mh)
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = ((MY0 + y) * W + (MX0 + x)) * 4
      grid[y * mw + x] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    }
  }
  var vaseMask = new Float32Array(mw * mh)
  for (let y = 1; y < mh - 1; y++) {
    for (let x = 1; x < mw - 1; x++) {
      const g =
        Math.abs(grid[y * mw + x + 1] - grid[y * mw + x - 1]) +
        Math.abs(grid[(y + 1) * mw + x] - grid[(y - 1) * mw + x])
      if (g > 25) vaseMask[y * mw + x] = 1
    }
  }
  const runMorph = (buf, radius, isMax) => {
    const out = new Float32Array(buf.length)
    // horizontal
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        let v = isMax ? 0 : 1
        for (let k = -radius; k <= radius; k++) {
          const xx = Math.min(mw - 1, Math.max(0, x + k))
          const s = buf[y * mw + xx]
          v = isMax ? Math.max(v, s) : Math.min(v, s)
        }
        out[y * mw + x] = v
      }
    }
    // vertical
    const out2 = new Float32Array(buf.length)
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        let v = isMax ? 0 : 1
        for (let k = -radius; k <= radius; k++) {
          const yy = Math.min(mh - 1, Math.max(0, y + k))
          const s = out[yy * mw + x]
          v = isMax ? Math.max(v, s) : Math.min(v, s)
        }
        out2[y * mw + x] = v
      }
    }
    return out2
  }
  // Seal hairline gaps in the contour (no opening first: the contour line is
  // only 1-3px thick and an erode would cut it apart).
  vaseMask = runMorph(vaseMask, 4, true)
  // Flood the OUTSIDE from the top/left/right box borders (not the bottom,
  // which cuts through the vase body). Whatever the flood cannot reach is
  // enclosed by the silhouette.
  const outside = new Uint8Array(mw * mh)
  const stack = []
  for (let x = 0; x < mw; x++) if (vaseMask[x] < 0.5) stack.push(x)
  for (let y = 0; y < mh; y++) {
    const l = y * mw
    const r = y * mw + mw - 1
    if (vaseMask[l] < 0.5) stack.push(l)
    if (vaseMask[r] < 0.5) stack.push(r)
  }
  while (stack.length) {
    const p = stack.pop()
    if (outside[p]) continue
    outside[p] = 1
    const px = p % mw
    const py = (p - px) / mw
    if (px > 0 && !outside[p - 1] && vaseMask[p - 1] < 0.5) stack.push(p - 1)
    if (px < mw - 1 && !outside[p + 1] && vaseMask[p + 1] < 0.5) stack.push(p + 1)
    if (py > 0 && !outside[p - mw] && vaseMask[p - mw] < 0.5) stack.push(p - mw)
    if (py < mh - 1 && !outside[p + mw] && vaseMask[p + mw] < 0.5) stack.push(p + mw)
  }
  // Keep ONLY the enclosed component containing the vase center: stray bokeh
  // speckles enclose their own little pockets, which must not be protected.
  const inside = new Uint8Array(mw * mh)
  {
    const seed = (Math.round(H * 0.4) - MY0) * mw + (mw >> 1)
    const st = [seed]
    let area = 0
    while (st.length) {
      const p = st.pop()
      if (inside[p] || outside[p]) continue
      inside[p] = 1
      area++
      const px = p % mw
      const py = (p - px) / mw
      if (px > 0 && !inside[p - 1] && !outside[p - 1]) st.push(p - 1)
      if (px < mw - 1 && !inside[p + 1] && !outside[p + 1]) st.push(p + 1)
      if (py > 0 && !inside[p - mw] && !outside[p - mw]) st.push(p - mw)
      if (py < mh - 1 && !inside[p + mw] && !outside[p + mw]) st.push(p + mw)
    }
    console.log(`vase mask component: ${area} px (box ${mw}x${mh})`)
  }
  for (let p = 0; p < mw * mh; p++) vaseMask[p] = inside[p] ? 1 : 0
  // Erode past the seal margin so the mask edge sits ~2px INSIDE the true
  // porcelain boundary: sky and porcelain white are colorimetrically
  // identical, so any protected background pixel becomes a white halo.
  vaseMask = runMorph(vaseMask, 6, false)
  // feather with two small box blurs
  for (let pass = 0; pass < 2; pass++) {
    const src = Float32Array.from(vaseMask)
    for (let y = 1; y < mh - 1; y++) {
      for (let x = 1; x < mw - 1; x++) {
        let s = 0
        for (let ky = -1; ky <= 1; ky++)
          for (let kx = -1; kx <= 1; kx++) s += src[(y + ky) * mw + (x + kx)]
        vaseMask[y * mw + x] = s / 9
      }
    }
  }
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
    // Inside the silhouette, protect only what is actually porcelain WHITE:
    // bright and warm-neutral (b-r <= 0ish). Background pockets enclosed by
    // the silhouette (under the rim, beside the finial) are cool (b-r 12+)
    // and must dim exactly like the background outside, or they stand out
    // as pale editing marks. Navy glaze is dark and needs no protection.
    const maskV =
      x >= MX0 && x < MX1 && y >= MY0 && y < MY1
        ? vaseMask[(y - MY0) * mw + (x - MX0)]
        : 0
    const whiteness = smoothstep(150, 180, L) * (1 - smoothstep(4, 12, b - r))
    const protect = maskV * whiteness
    // Porcelain protection gates the WHOLE sky weight: where the walk or the
    // tonal term overreach into the white glaze, the vase must stay intact.
    const wSky =
      Math.max(
        1 - smoothstep(med[x] - 5, med[x] + fallMed[x] + 2, y),
        skyLike * band,
      ) * (1 - protect)

    // Ground: night-leaning exposure (about -1.5 stops with a soft toe),
    // keeping 85% of the photo's own color and a cool white balance.
    const t = L / 255
    const darkT = Math.pow(t, 1.18) * 0.62
    const scaleL = darkT / Math.max(t, 0.004)
    const gray = darkT * 255
    const gr = lerp(gray, r * scaleL, 0.85) * 0.96
    const gg = lerp(gray, g * scaleL, 0.85) * 0.985
    const gb = lerp(gray, b * scaleL, 0.85) * 1.06

    // Sky: the photo's own sky darkened (more at the top of the frame,
    // lighter residue toward the horizon) and pulled toward dusk blue-gray.
    // Clamped so the sky treatment can only ever darken (a dark roof pixel
    // caught by the feather must never be lifted into a glowing rim).
    const f = lerp(0.3, 0.46, Math.min(1, fy * 2.4))
    const sr = Math.min(lerp(r * f, 74, 0.3), gr)
    const sg = Math.min(lerp(g * f, 88, 0.3), gg)
    const sb = Math.min(lerp(b * f, 126, 0.3), gb)

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
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(OUT)
console.log(`wrote ${OUT} (${W}x${H})`)

// ---- Lid sprite, cut from the DECODED jpeg (not the raw grade buffer!) so
// the sprite is pixel-identical to the background it sits on. Cutting from
// pre-compression pixels leaves a visible color difference along the box.
// Box in trimmed coords, must match LID in src/components/Stage.tsx. ----
const jpeg = await sharp(OUT).raw().toBuffer({ resolveWithObject: true })
const jch = jpeg.info.channels
const LID = { x0: 0.4608, x1: 0.5408, y0: 0.327, y1: 0.393 }
const lx = Math.round(LID.x0 * W)
const ly = Math.round(LID.y0 * H)
const lw = Math.round((LID.x1 - LID.x0) * W)
const lh = Math.round((LID.y1 - LID.y0) * H)
const FEATHER = Math.round(lw * 0.06)

const lidRgba = Buffer.alloc(lw * lh * 4)
for (let y = 0; y < lh; y++) {
  for (let x = 0; x < lw; x++) {
    const si = ((ly + y) * W + (lx + x)) * jch
    const di = (y * lw + x) * 4
    lidRgba[di] = jpeg.data[si]
    lidRgba[di + 1] = jpeg.data[si + 1]
    lidRgba[di + 2] = jpeg.data[si + 2]
    const edge = Math.min(x, lw - 1 - x, y, lh - 1 - y)
    lidRgba[di + 3] = Math.round(255 * Math.min(1, edge / FEATHER))
  }
}
await sharp(lidRgba, { raw: { width: lw, height: lh, channels: 4 } })
  .png()
  .toFile(OUT_LID)
console.log(`wrote ${OUT_LID} (${lw}x${lh}) box`, LID)
