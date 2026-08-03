// Hand-free sticker drafts with the standing-vase photo in an arched museum
// panel plus the badged glaze-navy QR. No cutout involved, so the edges are
// guaranteed clean. Output: stickers/vase2-6/7 at 2048x2048.
// Run: node scripts/make-arch-stickers.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'

const S = 2048
const URL = 'https://atte.one'
const NAVY = '#021150'
const PORC = '#f4f2ec'
const BLACK = '#0a0a0d'

const cornerMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="90" ry="90" fill="#fff"/></svg>`,
)

async function qr(size, dark) {
  const svg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark, light: '#00000000' },
  })
  return sharp(Buffer.from(svg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
}

async function badgedQr(size) {
  const q = await qr(size, NAVY)
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

// Arched photo panel of the standing vase, with a thin navy keyline.
async function archPanel(w, h) {
  const crop = await sharp('scripts/assets/vase-solo.jpg')
    .rotate()
    .extract({ left: 1560, top: 1700, width: 1560, height: 3180 })
    .resize(w, h)
    .png()
    .toBuffer()
  const R = w / 2
  const archPath = `M0,${h} L0,${R} A${R},${R} 0 0 1 ${w},${R} L${w},${h} Z`
  const mask = Buffer.from(
    `<svg width="${w}" height="${h}"><path d="${archPath}" fill="#fff"/></svg>`,
  )
  const panel = await sharp(crop)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const keyline = Buffer.from(
    `<svg width="${w + 24}" height="${h + 24}"><path d="M12,${h + 12} L12,${R + 12} A${R},${R} 0 0 1 ${w + 12},${R + 12} L${w + 12},${h + 12} Z" fill="none" stroke="${NAVY}" stroke-width="5"/></svg>`,
  )
  return { panel, keyline }
}

async function save(base, composites, name) {
  const flat = await base.composite(composites).png().toBuffer()
  await sharp(flat)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toFile(`stickers/${name}`)
  console.log(`wrote stickers/${name}`)
}

const solid = (color) =>
  sharp({ create: { width: S, height: S, channels: 4, background: color } })

// 6. Porcelain: arched vase panel right, badged QR left.
{
  const { panel, keyline } = await archPanel(760, 1560)
  const bq = await badgedQr(840)
  await save(
    solid(PORC),
    [
      { input: keyline, left: 1108, top: 232 },
      { input: panel, left: 1120, top: 244 },
      { input: bq, left: 150, top: 600 },
    ],
    'vase2-6-arch-hvid.png',
  )
}

// 7. Black: arched vase panel center-right, QR on a porcelain plate.
{
  const { panel, keyline } = await archPanel(720, 1470)
  const plateSize = 640
  const qrSize = 530
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}"><rect width="${plateSize}" height="${plateSize}" rx="48" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(qrSize)
  await save(
    solid(BLACK),
    [
      { input: keyline, left: 1028, top: 168 },
      { input: panel, left: 1040, top: 180 },
      { input: plate, left: 150, top: S - plateSize - 200 },
      {
        input: bq,
        left: 150 + (plateSize - qrSize) / 2,
        top: S - plateSize - 200 + (plateSize - qrSize) / 2,
      },
    ],
    'vase2-7-arch-sort.png',
  )
}
