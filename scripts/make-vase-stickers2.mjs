// Sticker drafts, round two: QR in the exact sampled glaze navy with the
// logo badge in its center, plus hand-free compositions using the vase
// cutout with a die-cut white outline.
// Output: stickers/vase2-*.png at 2048x2048.
// Run: node scripts/make-vase-stickers2.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'

const S = 2048
const URL = 'https://atte.one'
const NAVY = '#021150' // sampled from the glaze
const PORC = '#f4f2ec'
const BLACK = '#0a0a0d'
const OUT_DIR = 'stickers'
mkdirSync(OUT_DIR, { recursive: true })

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

async function whiteLogo(size) {
  return sharp('public/logo.png')
    .trim()
    .resize({ width: size, height: size, fit: 'inside' })
    .png()
    .toBuffer()
}

// QR with the Ashira logo in a navy disc at its center. ringColor clears the
// QR modules around the disc so the badge reads cleanly.
async function badgedQr(size, dark, ringColor) {
  const q = await qr(size, dark)
  const disc = Math.round(size * 0.24)
  const ring = Math.round(disc * 1.16)
  const logoSize = Math.round(disc * 0.62)
  const l = await whiteLogo(logoSize)
  const ringSvg = Buffer.from(
    `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${ringColor}"/></svg>`,
  )
  const discSvg = Buffer.from(
    `<svg width="${disc}" height="${disc}"><circle cx="${disc / 2}" cy="${disc / 2}" r="${disc / 2}" fill="${NAVY}"/></svg>`,
  )
  return sharp({ create: { width: size, height: size, channels: 4, background: '#0000' } })
    .composite([
      { input: q, left: 0, top: 0 },
      { input: ringSvg, left: Math.round((size - ring) / 2), top: Math.round((size - ring) / 2) },
      { input: discSvg, left: Math.round((size - disc) / 2), top: Math.round((size - disc) / 2) },
      { input: l, left: Math.round((size - logoSize) / 2), top: Math.round((size - logoSize) / 2) },
    ])
    .png()
    .toBuffer()
}

// Vase cutout resized, with an optional die-cut porcelain outline behind it.
async function vaseWithOutline(height, outlinePx) {
  const vase = await sharp('scripts/assets/vase-cutout.png')
    .resize({ height })
    .png()
    .toBuffer()
  const meta = await sharp(vase).metadata()
  if (!outlinePx) return { vase, outline: null, w: meta.width, h: meta.height }
  const alpha = await sharp(vase).extractChannel(3).raw().toBuffer()
  const dil = await sharp(alpha, {
    raw: { width: meta.width, height: meta.height, channels: 1 },
  })
    .blur(outlinePx / 2)
    .threshold(6)
    .blur(0.8)
    .raw()
    .toBuffer()
  const rgba = Buffer.alloc(meta.width * meta.height * 4)
  for (let i = 0; i < meta.width * meta.height; i++) {
    rgba[i * 4] = 244
    rgba[i * 4 + 1] = 242
    rgba[i * 4 + 2] = 236
    rgba[i * 4 + 3] = dil[i]
  }
  const outline = await sharp(rgba, {
    raw: { width: meta.width, height: meta.height, channels: 4 },
  })
    .png()
    .toBuffer()
  return { vase, outline, w: meta.width, h: meta.height }
}

const shadow = (w, h) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><defs><radialGradient id="g"><stop offset="0%" stop-color="#0a0a14" stop-opacity="0.32"/><stop offset="70%" stop-color="#0a0a14" stop-opacity="0.12"/><stop offset="100%" stop-color="#0a0a14" stop-opacity="0"/></radialGradient></defs><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="url(#g)"/></svg>`,
  )

const dateText = (fill, x, y, size = 66, spacing = 30) =>
  Buffer.from(
    `<svg width="${S}" height="${S}"><text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" letter-spacing="${spacing}" fill="${fill}">02.10.2026</text></svg>`,
  )

async function save(base, composites, name) {
  const flat = await base.composite(composites).png().toBuffer()
  await sharp(flat)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toFile(`${OUT_DIR}/${name}`)
  console.log(`wrote ${OUT_DIR}/${name}`)
}

const solid = (color) =>
  sharp({ create: { width: S, height: S, channels: 4, background: color } })

// 1. Hand photo with the badged navy QR on a porcelain plate.
{
  const photo = await sharp('scripts/assets/vase-hand.jpg')
    .rotate()
    .extract({ left: 0, top: 900, width: 4284, height: 4284 })
    .resize(S, S)
    .png()
    .toBuffer()
  const plateSize = 840
  const qrSize = 700
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}"><rect width="${plateSize}" height="${plateSize}" rx="56" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(qrSize, NAVY, PORC)
  await save(
    sharp(photo),
    [
      { input: plate, left: 100, top: 400 },
      { input: bq, left: 100 + (plateSize - qrSize) / 2, top: 400 + (plateSize - qrSize) / 2 },
    ],
    'vase2-1-foto-plade.png',
  )
}

// 2. Porcelain white: cutout vase to the right, navy QR to the left.
{
  const { vase, w, h } = await vaseWithOutline(1560, 0)
  const bq = await badgedQr(880, NAVY, PORC)
  await save(
    solid(PORC),
    [
      { input: shadow(900, 170), left: 1180 + Math.round(w / 2) - 450, top: 240 + h - 80 },
      { input: vase, left: 1180, top: 240 },
      { input: bq, left: 150, top: 560 },
    ],
    'vase2-2-hvid.png',
  )
}

// 3. Black: die-cut outlined vase, QR on a porcelain plate bottom-left.
{
  const { vase, outline, w, h } = await vaseWithOutline(1500, 22)
  const left = 940
  const top = 200
  const plateSize = 660
  const qrSize = 548
  const plate = Buffer.from(
    `<svg width="${plateSize}" height="${plateSize}"><rect width="${plateSize}" height="${plateSize}" rx="48" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(qrSize, NAVY, PORC)
  await save(
    solid(BLACK),
    [
      { input: outline, left, top },
      { input: vase, left, top },
      { input: plate, left: 150, top: S - plateSize - 190 },
      {
        input: bq,
        left: 150 + (plateSize - qrSize) / 2,
        top: S - plateSize - 190 + (plateSize - qrSize) / 2,
      },
    ],
    'vase2-3-sort.png',
  )
}

// 4. QR as the hero on porcelain, small outlined vase leaning on its corner.
{
  const bq = await badgedQr(1240, NAVY, PORC)
  const { vase, outline, w, h } = await vaseWithOutline(980, 16)
  await save(
    solid(PORC),
    [
      { input: bq, left: 300, top: 300 },
      { input: shadow(620, 130), left: 1310 + Math.round(w / 2) - 310, top: 940 + h - 60 },
      { input: outline, left: 1310, top: 940 },
      { input: vase, left: 1310, top: 940 },
    ],
    'vase2-4-qr-hero.png',
  )
}

// 5. Porcelain with the date: vase center, QR bottom-left, date top.
{
  const { vase, w, h } = await vaseWithOutline(1380, 0)
  const bq = await badgedQr(600, NAVY, PORC)
  await save(
    solid(PORC),
    [
      { input: dateText(NAVY, S / 2, 260) },
      { input: shadow(800, 150), left: Math.round(S / 2 - 400), top: 400 + h - 70 },
      { input: vase, left: Math.round((S - w) / 2), top: 400 },
      { input: bq, left: 170, top: S - 600 - 180 },
    ],
    'vase2-5-dato.png',
  )
}
