// Floating-vase stickers: the dark hand photo with the arm removed via a
// proper mask pipeline (classify -> connected component -> morphological
// close -> hole fill -> finger-bite cloning -> diffusion background), plus
// the badged glaze-navy QR, slightly smaller.
// Output: stickers/float-1-plade.png, float-2-hjoerne.png (2048x2048).
// Run: node scripts/make-floating-vase.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'

const S = 2048
const URL = 'https://atte.one'
const NAVY = '#021150'
const PORC = '#f4f2ec'

const { data } = await sharp('scripts/assets/vase-hand.jpg')
  .rotate()
  .extract({ left: 0, top: 900, width: 4284, height: 4284 })
  .resize(S, S, { kernel: 'lanczos3' })
  .raw()
  .toBuffer({ resolveWithObject: true })

const px = (x, y) => {
  const i = (y * S + x) * 3
  return [data[i], data[i + 1], data[i + 2]]
}

// ---- 1. Classify glaze/porcelain pixels inside the vase's bounding box ----
const BX0 = 820
const BX1 = 1450
const BY0 = 270
const BY1 = 1520
const cls = new Uint8Array(S * S)
for (let y = BY0; y <= BY1; y++) {
  for (let x = BX0; x <= BX1; x++) {
    const [r, g, b] = px(x, y)
    if (
      (b > r + 6 && b > 22) ||
      (Math.max(r, g, b) > 110 && b >= r - 6) ||
      // The lid zone is nearly black navy with a warm cast; no hand is up
      // there, so plain brightness against the darker backdrop suffices.
      (y < 640 && x > 930 && x < 1150 && Math.max(r, g, b) > 34)
    ) {
      cls[y * S + x] = 1
    }
  }
}

// ---- 2. Largest connected component from a seed inside the belly ----
const comp = new Uint8Array(S * S)
{
  const stack = [[1100, 700], [1150, 1050], [1050, 1300], [1060, 500], [1040, 420]]
  while (stack.length) {
    const [x, y] = stack.pop()
    const i = y * S + x
    if (x < BX0 || x > BX1 || y < BY0 || y > BY1 || comp[i] || !cls[i]) continue
    comp[i] = 1
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }
}

// Separable dilate/erode with a square window.
function dilate(src, r) {
  const tmp = new Uint8Array(S * S)
  const out = new Uint8Array(S * S)
  for (let y = 0; y < S; y++) {
    let count = 0
    for (let x = -r; x < S; x++) {
      if (x + r < S && src[y * S + (x + r)]) count++
      if (x - r - 1 >= 0 && src[y * S + (x - r - 1)]) count--
      if (x >= 0) tmp[y * S + x] = count > 0 ? 1 : 0
    }
  }
  for (let x = 0; x < S; x++) {
    let count = 0
    for (let y = -r; y < S; y++) {
      if (y + r < S && tmp[(y + r) * S + x]) count++
      if (y - r - 1 >= 0 && tmp[(y - r - 1) * S + x]) count--
      if (y >= 0) out[y * S + x] = count > 0 ? 1 : 0
    }
  }
  return out
}
function erode(src, r) {
  const inv = new Uint8Array(S * S)
  for (let i = 0; i < S * S; i++) inv[i] = src[i] ? 0 : 1
  const d = dilate(inv, r)
  const out = new Uint8Array(S * S)
  for (let i = 0; i < S * S; i++) out[i] = d[i] ? 0 : 1
  return out
}

// ---- 3. Close small pattern gaps, then bridge the finger bites ----
const sum = (a) => a.reduce((s, v) => s + v, 0)
console.log('comp:', sum(comp))
let mask = erode(dilate(comp, 5), 5)
console.log('after close5:', sum(mask))
mask = erode(dilate(mask, 56), 56)
console.log('after close56:', sum(mask))

// ---- 4. Fill any interior holes (flood the outside, invert) ----
{
  const outside = new Uint8Array(S * S)
  const stack = [[0, 0]]
  while (stack.length) {
    const [x, y] = stack.pop()
    const i = y * S + x
    if (x < 0 || x >= S || y < 0 || y >= S || outside[i] || mask[i]) continue
    outside[i] = 1
    if (x > 0) stack.push([x - 1, y])
    if (x < S - 1) stack.push([x + 1, y])
    if (y > 0) stack.push([x, y - 1])
    if (y < S - 1) stack.push([x, y + 1])
  }
  for (let i = 0; i < S * S; i++) if (!outside[i]) mask[i] = 1
}
console.log('after holes:', mask.reduce((s, v) => s + v, 0))

// ---- 5. Clone glaze into the bite areas (mask but not classified) ----
const patched = Buffer.from(data)
const setP = (x, y, [r, g, b]) => {
  const i = (y * S + x) * 3
  patched[i] = r
  patched[i + 1] = g
  patched[i + 2] = b
}
const isHandPixel = (x, y) => {
  const [r, g, b] = px(x, y)
  return (r > g + 15 && r > b + 25 && r > 70) || (r > b + 8 && Math.max(r, g, b) < 90)
}
for (let y = BY0; y <= BY1; y++) {
  for (let x = BX0; x <= BX1; x++) {
    const i = y * S + x
    if (!mask[i] || comp[i] || !isHandPixel(x, y)) continue
    let done = false
    for (let d = 2; d < 300 && !done; d++) {
      for (const yy of [y - d, y + d]) {
        if (yy < BY0 || yy > BY1) continue
        if (comp[yy * S + x]) {
          setP(x, y, px(x, yy))
          done = true
          break
        }
      }
    }
  }
}

// ---- 6. Synthesize the backdrop by diffusion at low res ----
const LOW = 256
const scale = S / LOW
const known = new Float32Array(LOW * LOW * 3)
const isKnown = new Uint8Array(LOW * LOW)
const vaseDil = dilate(mask, 24)
for (let ly = 0; ly < LOW; ly++) {
  for (let lx = 0; lx < LOW; lx++) {
    const x = Math.min(S - 1, Math.round(lx * scale + scale / 2))
    const y = Math.min(S - 1, Math.round(ly * scale + scale / 2))
    const inArm = x < 1240 && y > 900
    const inArmB = x >= 1240 && x < 1500 && y > 940 && y < 1400
    const inVaseBox = x > BX0 - 40 && x < BX1 + 40 && y > BY0 - 40 && y < BY1 + 60
    if (!vaseDil[y * S + x] && !inArm && !inArmB && !inVaseBox) {
      const [r, g, b] = px(x, y)
      const i = (ly * LOW + lx) * 3
      known[i] = r
      known[i + 1] = g
      known[i + 2] = b
      isKnown[ly * LOW + lx] = 1
    }
  }
}
const field = Float32Array.from(known)
for (let iter = 0; iter < 600; iter++) {
  for (let ly = 0; ly < LOW; ly++) {
    for (let lx = 0; lx < LOW; lx++) {
      if (isKnown[ly * LOW + lx]) continue
      let sr = 0
      let sg = 0
      let sb = 0
      let n = 0
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = lx + dx
        const ny = ly + dy
        if (nx < 0 || nx >= LOW || ny < 0 || ny >= LOW) continue
        const j = (ny * LOW + nx) * 3
        sr += field[j]
        sg += field[j + 1]
        sb += field[j + 2]
        n++
      }
      const i = (ly * LOW + lx) * 3
      field[i] = sr / n
      field[i + 1] = sg / n
      field[i + 2] = sb / n
    }
  }
}
const bgLow = Buffer.alloc(LOW * LOW * 3)
for (let i = 0; i < LOW * LOW * 3; i++) bgLow[i] = Math.round(field[i])
const bgFull = await sharp(bgLow, { raw: { width: LOW, height: LOW, channels: 3 } })
  .resize(S, S, { kernel: 'lanczos3' })
  .raw()
  .toBuffer()

// ---- 7. Composite: backdrop + vase through a feathered mask ----
const maskSoft = await sharp(Buffer.from(mask.map((v) => v * 255)), {
  raw: { width: S, height: S, channels: 1 },
})
  .blur(1.6)
  .raw()
  .toBuffer()
console.log(
  'maskSoft bytes:', maskSoft.length,
  'nonzero:', maskSoft.reduce((s, v) => s + (v > 128 ? 1 : 0), 0),
)
// sharp may promote the 1-channel raw to multi-channel: index accordingly.
const mch = maskSoft.length / (S * S)
const outRgb = Buffer.alloc(S * S * 3)
for (let i = 0; i < S * S; i++) {
  const a = maskSoft[i * mch] / 255
  for (let c = 0; c < 3; c++) {
    outRgb[i * 3 + c] = Math.round(patched[i * 3 + c] * a + bgFull[i * 3 + c] * (1 - a))
  }
}
const photo = await sharp(outRgb, { raw: { width: S, height: S, channels: 3 } })
  .png()
  .toBuffer()

// ---- QR + layouts ----
async function badgedQr(size) {
  const svg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark: NAVY, light: '#00000000' },
  })
  const q = await sharp(Buffer.from(svg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
  const disc = Math.round(size * 0.24)
  const ring = Math.round(disc * 1.16)
  const logoSize = Math.round(disc * 0.62)
  const logo = await sharp('public/logo.png')
    .trim()
    .resize({ width: logoSize, height: logoSize, fit: 'inside' })
    .png()
    .toBuffer()
  const ringSvg = Buffer.from(
    `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${PORC}"/></svg>`,
  )
  const discSvg = Buffer.from(
    `<svg width="${disc}" height="${disc}"><circle cx="${disc / 2}" cy="${disc / 2}" r="${disc / 2}" fill="${NAVY}"/></svg>`,
  )
  return sharp({ create: { width: size, height: size, channels: 4, background: '#0000' } })
    .composite([
      { input: q },
      { input: ringSvg, left: Math.round((size - ring) / 2), top: Math.round((size - ring) / 2) },
      { input: discSvg, left: Math.round((size - disc) / 2), top: Math.round((size - disc) / 2) },
      { input: logo, left: Math.round((size - logoSize) / 2), top: Math.round((size - logoSize) / 2) },
    ])
    .png()
    .toBuffer()
}

const cornerMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="90" ry="90" fill="#fff"/></svg>`,
)
async function save(composites, name) {
  const flat = await sharp(photo).composite(composites).png().toBuffer()
  await sharp(flat)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toFile(`stickers/${name}`)
  console.log(`wrote stickers/${name}`)
}

{
  const plateSize = 660
  const qrSize = 548
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}"><rect width="${plateSize}" height="${plateSize}" rx="46" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(qrSize)
  await save(
    [
      { input: plate, left: 150, top: 480 },
      { input: bq, left: 150 + (plateSize - qrSize) / 2, top: 480 + (plateSize - qrSize) / 2 },
    ],
    'float-1-plade.png',
  )
}
{
  const plateSize = 520
  const qrSize = 430
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}"><rect width="${plateSize}" height="${plateSize}" rx="40" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(qrSize)
  await save(
    [
      { input: plate, left: 150, top: S - plateSize - 170 },
      {
        input: bq,
        left: 150 + (plateSize - qrSize) / 2,
        top: S - plateSize - 170 + (plateSize - qrSize) / 2,
      },
    ],
    'float-2-hjoerne.png',
  )
}
