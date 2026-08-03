// Generates square sticker drafts for the ATTE project: QR code to
// https://atte.one plus the Ashira logo, clean black/white brand look.
// Output: stickers/*.png at 2048x2048 (about 17 cm at 300 dpi).
// Run: node scripts/make-stickers.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'

const S = 2048
const URL = 'https://atte.one'
const OUT_DIR = 'stickers'
mkdirSync(OUT_DIR, { recursive: true })

const BLACK = '#050508'
const WHITE = '#f4f2ec'

// QR as PNG buffer at a given pixel size and color. Transparent background,
// error correction H so a center badge cannot break scanning.
async function qr(size, dark) {
  const svg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark, light: '#00000000' },
  })
  return sharp(Buffer.from(svg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
}

// Logo in white (as shipped) or black (negated RGB, alpha preserved).
async function logo(size, color) {
  let img = sharp('public/logo.png').trim()
  if (color === 'black') img = img.negate({ alpha: false })
  return img.resize({ width: size, height: size, fit: 'inside' }).png().toBuffer()
}

function base(color) {
  return sharp({
    create: { width: S, height: S, channels: 4, background: color },
  })
}

// Slightly rounded corners so the drafts read as die-cut stickers.
const cornerMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect x="0" y="0" width="${S}" height="${S}" rx="90" ry="90" fill="#fff"/></svg>`,
)

async function save(pipeline, name) {
  const flat = await pipeline.png().toBuffer()
  await sharp(flat)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toFile(`${OUT_DIR}/${name}`)
  console.log(`wrote ${OUT_DIR}/${name}`)
}

const dateText = (fill, y, size = 74) =>
  Buffer.from(
    `<svg width="${S}" height="${S}"><text x="${S / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" letter-spacing="34" fill="${fill}">02.10.2026</text></svg>`,
  )

// 1. Big white QR on black, small logo bottom center. Pure and stark.
{
  const q = await qr(1360, '#ffffff')
  const l = await logo(230, 'white')
  await save(
    base(BLACK).composite([
      { input: q, left: (S - 1360) / 2, top: 250 },
      { input: l, left: (S - 230) / 2, top: 1735 },
    ]),
    'sticker-1-stor-qr-sort.png',
  )
}

// 2. Big black QR on porcelain white, black logo in the bottom-right corner.
{
  const q = await qr(1360, '#0a0a0f')
  const l = await logo(240, 'black')
  await save(
    base(WHITE).composite([
      { input: q, left: (S - 1360) / 2, top: 250 },
      { input: l, left: S - 240 - 140, top: S - 240 - 130 },
    ]),
    'sticker-2-stor-qr-hvid.png',
  )
}

// 3. Logo as the hero, smaller QR tucked in the bottom-right corner.
{
  const q = await qr(470, '#ffffff')
  const l = await logo(980, 'white')
  await save(
    base(BLACK).composite([
      { input: l, left: (S - 980) / 2, top: 300 },
      { input: q, left: S - 470 - 150, top: S - 470 - 150 },
    ]),
    'sticker-3-logo-hero.png',
  )
}

// 4. Black QR with the logo in a round badge at its center (white sticker).
{
  const q = await qr(1420, '#0a0a0f')
  const badgeSize = 340
  const badge = Buffer.from(
    `<svg width="${badgeSize}" height="${badgeSize}"><circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2}" fill="${WHITE}"/></svg>`,
  )
  const l = await logo(216, 'black')
  await save(
    base(WHITE).composite([
      { input: q, left: (S - 1420) / 2, top: (S - 1420) / 2 },
      { input: badge, left: (S - badgeSize) / 2, top: (S - badgeSize) / 2 },
      { input: l, left: (S - 216) / 2, top: (S - 216) / 2 },
    ]),
    'sticker-4-qr-logobadge.png',
  )
}

// 5. Medium white QR on black with the release date up top and logo below.
{
  const q = await qr(1060, '#ffffff')
  const l = await logo(270, 'white')
  await save(
    base(BLACK).composite([
      { input: dateText('#e8e6df', 300) },
      { input: q, left: (S - 1060) / 2, top: 470 },
      { input: l, left: (S - 270) / 2, top: 1660 },
    ]),
    'sticker-5-dato.png',
  )
}
