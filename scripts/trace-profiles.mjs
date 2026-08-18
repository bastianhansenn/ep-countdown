// Traces the REAL vase + pedestal silhouettes from the original street photo
// lathe profiles, so the 3D copy matches the photographed originals 1:1 in
// form and size. Output: src/lib/realProfiles.json
//
// The vase is the only in-focus subject, so a sharpness mask + flood fill
// isolates its silhouette regardless of the blue/white glaze pattern. The
// pedestal is near-black against the cobbles, traced by dark runs.
// Run: node scripts/trace-profiles.mjs
import sharp from 'sharp'
import { writeFileSync } from 'fs'

// Read the ORIGINAL photo, never public/background.jpg: that one has already
// had the vase painted out (using these very profiles), so tracing it would
// silently produce an empty silhouette.
const { data, info } = await sharp('scripts/assets/street-pro.jpg')
  .resize({ width: 3600, kernel: 'lanczos3' })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height

const AXIS = 0.5067 // vase + pedestal axis (probed, px 1824)
// Vertical landmarks (fractions of H), read from axis luminance:
const FINIAL_TOP_V = 0.325
const SEAM_V = 0.379 // underside of the lid's white brim: the dark collar
                     // below it is the vase's own neck, not part of the lid
const FOOT_BOTTOM_V = 0.649
const MODEL_H = 3.02 // model units, foot (y=0) -> finial top
const pxPerUnit = ((FOOT_BOTTOM_V - FINIAL_TOP_V) * H) / MODEL_H
const yModel = (fv) => ((FOOT_BOTTOM_V - fv) * H) / pxPerUnit

const lum = (x, y) => {
  const i = (y * W + x) * 4
  return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
}
const lerp = (a, b, t) => a + (b - a) * t

// ---- Vase silhouette via sharpness mask + flood fill ----
const MX0 = Math.round(W * (AXIS - 0.07))
const MX1 = Math.round(W * (AXIS + 0.07))
const MY0 = Math.round(H * 0.31)
const MY1 = Math.round(H * 0.66)
const mw = MX1 - MX0
const mh = MY1 - MY0
const grid = new Float32Array(mw * mh)
for (let y = 0; y < mh; y++)
  for (let x = 0; x < mw; x++) grid[y * mw + x] = lum(MX0 + x, MY0 + y)
let mask = new Float32Array(mw * mh)
for (let y = 1; y < mh - 1; y++)
  for (let x = 1; x < mw - 1; x++) {
    const g =
      Math.abs(grid[y * mw + x + 1] - grid[y * mw + x - 1]) +
      Math.abs(grid[(y + 1) * mw + x] - grid[(y - 1) * mw + x])
    if (g > 22) mask[y * mw + x] = 1
  }
const morph = (buf, r, isMax) => {
  const a = new Float32Array(buf.length)
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      let v = isMax ? 0 : 1
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(mw - 1, Math.max(0, x + k))
        v = isMax ? Math.max(v, buf[y * mw + xx]) : Math.min(v, buf[y * mw + xx])
      }
      a[y * mw + x] = v
    }
  const b = new Float32Array(buf.length)
  for (let y = 0; y < mh; y++)
    for (let x = 0; x < mw; x++) {
      let v = isMax ? 0 : 1
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(mh - 1, Math.max(0, y + k))
        v = isMax ? Math.max(v, a[yy * mw + x]) : Math.min(v, a[yy * mw + x])
      }
      b[y * mw + x] = v
    }
  return b
}
mask = morph(mask, 4, true) // seal hairline gaps in the contour
const outside = new Uint8Array(mw * mh)
const stack = []
for (let x = 0; x < mw; x++) if (mask[x] < 0.5) stack.push(x)
for (let y = 0; y < mh; y++) {
  if (mask[y * mw] < 0.5) stack.push(y * mw)
  if (mask[y * mw + mw - 1] < 0.5) stack.push(y * mw + mw - 1)
}
while (stack.length) {
  const p = stack.pop()
  if (outside[p]) continue
  outside[p] = 1
  const px = p % mw
  const py = (p - px) / mw
  if (px > 0 && !outside[p - 1] && mask[p - 1] < 0.5) stack.push(p - 1)
  if (px < mw - 1 && !outside[p + 1] && mask[p + 1] < 0.5) stack.push(p + 1)
  if (py > 0 && !outside[p - mw] && mask[p - mw] < 0.5) stack.push(p - mw)
  if (py < mh - 1 && !outside[p + mw] && mask[p + mw] < 0.5) stack.push(p + mw)
}
const inside = new Uint8Array(mw * mh)
{
  const seed = (Math.round(H * 0.5) - MY0) * mw + Math.round((AXIS * W) - MX0)
  const st = [seed]
  while (st.length) {
    const p = st.pop()
    if (inside[p] || outside[p]) continue
    inside[p] = 1
    const px = p % mw
    const py = (p - px) / mw
    if (px > 0 && !inside[p - 1] && !outside[p - 1]) st.push(p - 1)
    if (px < mw - 1 && !inside[p + 1] && !outside[p + 1]) st.push(p + 1)
    if (py > 0 && !inside[p - mw] && !outside[p - mw]) st.push(p - mw)
    if (py < mh - 1 && !inside[p + mw] && !outside[p + mw]) st.push(p + mw)
  }
}
// Half-width relative to axis (subtract seal +4 and ~4px bokeh bleed).
const axPx = AXIS * W
const halfAt = (ay) => {
  const by = ay - MY0
  if (by < 0 || by >= mh) return 0
  let left = -1
  let right = -1
  for (let x = 0; x < mw; x++)
    if (inside[by * mw + x]) {
      if (left < 0) left = x
      right = x
    }
  if (left < 0) return 0
  const l = MX0 + left
  const r = MX0 + right
  return Math.max(0, ((r - l) / 2 - 8)) / pxPerUnit
}

// ---- Body profile: foot up to the seam ----
// The body is traced from fv 0.628 (just above the foot flare; below that the
// dark plate fills the mask box) up to the neck (SEAM_V). The small splayed
// foot below 0.628 is added by hand from the measured foot width.
const TRACE_TOP_V = 0.628
// Stop the trace below the lid: the silhouette mask includes the lid's wide
// white brim, so tracing all the way to the seam flares the neck out to brim
// width. The straight neck above is added by hand at its measured width.
const TRACE_END_V = 0.408
const NECK_HALF = 0.31
const bodySteps = 30
let bodyR = []
for (let i = 0; i <= bodySteps; i++) {
  const fv = TRACE_TOP_V - (i / bodySteps) * (TRACE_TOP_V - TRACE_END_V)
  bodyR.push(halfAt(Math.round(fv * H)))
}
// Heavy smoothing: the raw per-row widths wobble a few px, and a spline
// through that wobble renders as dents in the lathe. The real vase is a clean
// baluster, so the silhouette should be smooth.
for (let pass = 0; pass < 12; pass++) {
  const s = [...bodyR]
  for (let i = 1; i < bodyR.length - 1; i++) bodyR[i] = (s[i - 1] + s[i] * 2 + s[i + 1]) / 4
}
const traced = bodyR.map((r, i) => {
  const fv = TRACE_TOP_V - (i / bodySteps) * (TRACE_TOP_V - TRACE_END_V)
  return [+r.toFixed(4), +yModel(fv).toFixed(4)]
})
// Neck: from the traced shoulder up to the seam, easing into NECK_HALF.
const neck = [
  [+((traced[traced.length - 1][0] + NECK_HALF) / 2).toFixed(4), +yModel(0.4).toFixed(4)],
  [NECK_HALF, +yModel(0.393).toFixed(4)],
  [NECK_HALF, +yModel(SEAM_V).toFixed(4)],
]
// Clean splayed foot below y(0.628), rim never at x=0 (no UV pole).
const yTraceTop = yModel(TRACE_TOP_V) // ~0.196
const footTopHalf = traced[0][0]
const body = [
  [+(footTopHalf * 0.9).toFixed(4), 0],
  [+(footTopHalf * 0.82).toFixed(4), +(yTraceTop * 0.45).toFixed(4)],
  [+(footTopHalf * 0.9).toFixed(4), +(yTraceTop * 0.85).toFixed(4)],
  ...traced,
  ...neck,
]

// ---- Lid: hand arc from the measured landmarks. The removable lid is the
// wide white porcelain brim (fv 0.369-0.379) and the navy dome above it up to
// the finial base; the dark collar underneath belongs to the vase's neck.
// Local y from the seam. ----
const seamY = yModel(SEAM_V)
const finBaseY = yModel(0.348)
const lid = [
  [0.34, 0], // brim underside, meeting the neck
  [0.47, +(yModel(0.3765) - seamY).toFixed(4)], // widest overhang
  [0.45, +(yModel(0.3725) - seamY).toFixed(4)], // brim top face
  [0.34, +(yModel(0.3695) - seamY).toFixed(4)], // step up to the dome
  [0.33, +(yModel(0.3635) - seamY).toFixed(4)],
  [0.26, +(yModel(0.3565) - seamY).toFixed(4)], // dome shoulder
  [0.14, +(finBaseY - seamY).toFixed(4)], // dome top / finial base
]

// ---- Finial box for the primitive group ----
const finial = {
  baseY: +(finBaseY - seamY).toFixed(4),
  height: +(yModel(FINIAL_TOP_V) - finBaseY).toFixed(4),
}

// ---- Pedestal: dark-run trace below the plate (near-black on cobbles) ----
const darkHalf = (ay, thr) => {
  const x0 = Math.round(W * 0.36)
  const x1 = Math.round(W * 0.64)
  let bl = -1
  let br = -1
  let s = -1
  for (let x = x0; x <= x1 + 1; x++) {
    const dark = x <= x1 && lum(x, ay) < thr
    if (dark && s < 0) s = x
    if (!dark && s >= 0) {
      if (s <= axPx && x - 1 >= axPx && x - 1 - s > br - bl) {
        bl = s
        br = x - 1
      }
      s = -1
    }
  }
  if (bl < 0) return 0
  return (br - bl) / 2 / pxPerUnit
}
const PLATE_TOP_V = 0.652
const PLATE_BOTTOM_V = 0.688
const plateHalf = Math.max(darkHalf(Math.round(0.67 * H), 75), darkHalf(Math.round(0.678 * H), 75))
// Column from just under the plate to the frame bottom. thr 78 catches the
// blurred edges of the turned baluster (its urn bulge under the plate has a
// soft dark-to-cobble gradient that a tighter threshold clips off).
const pedestal = []
const pedSteps = 46
for (let i = 0; i <= pedSteps; i++) {
  const fv = PLATE_BOTTOM_V + (i / pedSteps) * (0.998 - PLATE_BOTTOM_V)
  let r = darkHalf(Math.round(fv * H), 78)
  if (r === 0) r = pedestal.length ? pedestal[pedestal.length - 1][0] : 0.05
  pedestal.push([+r.toFixed(4), +yModel(fv).toFixed(4)])
}
for (let pass = 0; pass < 2; pass++) {
  const s = pedestal.map((p) => p[0])
  for (let i = 1; i < pedestal.length - 1; i++)
    pedestal[i][0] = +((s[i - 1] + s[i] * 2 + s[i + 1]) / 4).toFixed(4)
}

const out = {
  meta: {
    AXIS,
    FINIAL_TOP_V,
    SEAM_V,
    FOOT_BOTTOM_V,
    MODEL_H,
    seamY: +seamY.toFixed(4),
    plate: {
      topY: +yModel(PLATE_TOP_V).toFixed(4),
      bottomY: +yModel(PLATE_BOTTOM_V).toFixed(4),
      half: +plateHalf.toFixed(4),
    },
    finial,
  },
  body,
  lid,
  pedestal,
}
writeFileSync('src/lib/realProfiles.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out.meta, null, 2))
console.log(`body ${body.length}, lid ${lid.length}, pedestal ${pedestal.length}`)
console.log('body max half', Math.max(...body.map((p) => p[0])).toFixed(3), 'unit')
console.log('pedestal max half', Math.max(...pedestal.map((p) => p[0])).toFixed(3), 'unit')
