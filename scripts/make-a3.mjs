// A3 print masters (297x420 mm at 300 dpi = 3508x4961 px) of the two chosen
// designs: the authorized eye chart and the QR-that-is-the-vase. Everything
// is rendered natively at target resolution, nothing is upscaled.
// Run: node scripts/make-a3.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'

const W = 3508
const H = 4961
const URL = 'https://atte.one'
const NAVY = '#021150'
const PORC = '#f4f2ec'

async function logoBuf(size, variant = 'white') {
  let img = sharp('public/logo.png').trim()
  if (variant === 'black') img = img.negate({ alpha: false })
  return img.resize({ width: size, height: size, fit: 'inside' }).png().toBuffer()
}

async function saveA3(base, composites, name) {
  await base
    .composite(composites)
    .withMetadata({ density: 300 })
    .png()
    .toFile(`stickers/${name}`)
  console.log(`wrote stickers/${name}`)
}
const solid = () =>
  sharp({ create: { width: W, height: H, channels: 4, background: PORC } })

// Badged QR (same look as the approved stickers), rendered at target size.
async function badgedQr(size) {
  const qsvg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark: NAVY, light: '#00000000' },
  })
  const q = await sharp(Buffer.from(qsvg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
  const disc = Math.round(size * 0.24)
  const ring = Math.round(disc * 1.16)
  const logoSize = Math.round(disc * 0.62)
  const l = await logoBuf(logoSize)
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
      { input: l, left: Math.round((size - logoSize) / 2), top: Math.round((size - logoSize) / 2) },
    ])
    .png()
    .toBuffer()
}

// ---- 1. The authorized eye chart, A3 ----
{
  let y = 980
  let rowSvg = ''
  const rows = [
    ['A', 640, '6/60'],
    ['T T E', 420, '6/36'],
    ['1 6 1 0', 270, '6/24'],
    ['2 0 2 6', 180, '6/18'],
    ['A T T E . O N E', 112, '6/12'],
    ['SCAN NÅR DU ER TÆT NOK', 66, '6/9'],
    ['ER DU TÆT NOK TIL AT LÆSE DETTE KAN DU OGSÅ SCANNE', 40, '6/6'],
  ]
  for (const [text, size, acuity] of rows) {
    rowSvg += `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" letter-spacing="${Math.max(8, size * 0.22)}" fill="${NAVY}">${text}</text>`
    rowSvg += `<text x="${W - 380}" y="${y - size * 0.3}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="52" fill="#9a978c">${acuity}</text>`
    rowSvg += `<line x1="380" y1="${y + 64}" x2="${W - 380}" y2="${y + 64}" stroke="#d8d4c6" stroke-width="3"/>`
    y += size + 200
  }
  const frame = Buffer.from(
    `<svg width="${W}" height="${H}">
      <rect x="210" y="210" width="${W - 420}" height="${H - 420}" fill="none" stroke="${NAVY}" stroke-width="14"/>
      <rect x="254" y="254" width="${W - 508}" height="${H - 508}" fill="none" stroke="${NAVY}" stroke-width="4"/>
      <text x="${W / 2}" y="450" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="78" letter-spacing="34" fill="#9a978c">AUTORISERET SYNSPRØVE</text>
      ${rowSvg}
      <text x="${W / 2}" y="4660" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="72" letter-spacing="24" fill="${NAVY}">NÆSTE LEDIGE TID: 16.10.2026</text>
    </svg>`,
  )
  const logo = await logoBuf(260, 'black')
  const bq = await badgedQr(560)
  await saveA3(
    solid(),
    [
      { input: frame },
      { input: logo, left: 380, top: 350 },
      { input: bq, left: 380, top: 3980 },
    ],
    'a3-synsproeve.png',
  )
}

// ---- 2. The QR that IS the vase, A3 ----
{
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
  const profileRadiusAt = (profile, py) => {
    for (let i = 1; i < profile.length; i++) {
      if (py <= profile[i][1]) {
        const [r0, p0] = profile[i - 1]
        const [r1, p1] = profile[i]
        const t = p1 === p0 ? 1 : (py - p0) / (p1 - p0)
        return r0 + (r1 - r0) * t
      }
    }
    return profile[profile.length - 1][0]
  }
  const vaseRadiusAt = (yy) => {
    if (yy <= 2.5) return profileRadiusAt(BODY_PROFILE, Math.max(0, yy))
    if (yy <= 2.78) return profileRadiusAt(LID_PROFILE, Math.min(0.26, yy - 2.52))
    if (yy <= 3.02) {
      const t = (yy - 2.9) / 0.12
      return 0.13 * Math.sqrt(Math.max(0, 1 - t * t))
    }
    return 0
  }

  const qr = QRCode.create(URL, { errorCorrectionLevel: 'H' })
  const N = qr.modules.size
  const getM = (r, c) => qr.modules.get(r, c)
  const QSIZE = 3020
  const cell = QSIZE / N
  const rTop = 0.06 * N
  const rBot = 0.97 * N
  const scale = (rBot - rTop) / 3.02
  const inside = (r, c) => {
    const yy = (rBot - r) / scale
    const xx = (c - N / 2) / scale
    return Math.abs(xx) <= vaseRadiusAt(yy)
  }
  let rects = ''
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!getM(r, c)) continue
      const fill = inside(r + 0.5, c + 0.5) ? '#2447c9' : '#10152e'
      rects += `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${(cell + 0.5).toFixed(2)}" height="${(cell + 0.5).toFixed(2)}" fill="${fill}"/>`
    }
  }
  const qrSvg = Buffer.from(`<svg width="${QSIZE}" height="${QSIZE}">${rects}</svg>`)
  const disc = 600
  const ring = 690
  const l = await logoBuf(365)
  const badge = Buffer.from(
    `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${PORC}"/><circle cx="${ring / 2}" cy="${ring / 2}" r="${disc / 2}" fill="${NAVY}"/></svg>`,
  )
  const caption = Buffer.from(
    `<svg width="${W}" height="${H}"><text x="${W / 2}" y="4540" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="118" letter-spacing="64" fill="${NAVY}">16.10.2026</text></svg>`,
  )
  const qrTop = 780
  await saveA3(
    solid(),
    [
      { input: await sharp(qrSvg).png().toBuffer(), left: (W - QSIZE) / 2, top: qrTop },
      { input: badge, left: (W - ring) / 2, top: qrTop + (QSIZE - ring) / 2 },
      { input: l, left: Math.round((W - 365) / 2), top: qrTop + Math.round((QSIZE - 365) / 2) },
      { input: caption },
    ],
    'a3-qr-vase.png',
  )

  // Square edition: 297x297 mm at 300 dpi.
  const SQ = 3508
  const sqTop = 190
  const sqCaption = Buffer.from(
    `<svg width="${SQ}" height="${SQ}"><text x="${SQ / 2}" y="3392" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="100" letter-spacing="56" fill="${NAVY}">16.10.2026</text></svg>`,
  )
  await sharp({ create: { width: SQ, height: SQ, channels: 4, background: PORC } })
    .composite([
      { input: await sharp(qrSvg).png().toBuffer(), left: (SQ - QSIZE) / 2, top: sqTop },
      { input: badge, left: (SQ - ring) / 2, top: sqTop + (QSIZE - ring) / 2 },
      { input: l, left: Math.round((SQ - 365) / 2), top: sqTop + Math.round((QSIZE - 365) / 2) },
      { input: sqCaption },
    ])
    .withMetadata({ density: 300 })
    .png()
    .toFile('stickers/kvadrat-qr-vase.png')
  console.log('wrote stickers/kvadrat-qr-vase.png')
}
