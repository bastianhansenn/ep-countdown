// Sticker drafts built ON the vase-in-hand photo: square crop of the photo
// with the atte.one QR code and the Ashira logo composed into the dark
// negative space. Output: stickers/foto-*.png at 2048x2048.
// Run: node scripts/make-photo-stickers.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'
import { mkdirSync } from 'node:fs'

const S = 2048
const URL = 'https://atte.one'
const OUT_DIR = 'stickers'
mkdirSync(OUT_DIR, { recursive: true })

// Square crop of the portrait photo: keeps the vase upper-center-right, the
// hand below it, and the large dark field on the left for the QR code.
const photoBase = await sharp('scripts/assets/vase-hand.jpg')
  .rotate()
  .extract({ left: 0, top: 900, width: 4284, height: 4284 })
  .resize(S, S, { kernel: 'lanczos3' })
  .png()
  .toBuffer()

async function qr(size, opts = {}) {
  const svg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark: opts.color || '#ffffff', light: '#00000000' },
  })
  return sharp(Buffer.from(svg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
}

async function logo(size) {
  return sharp('public/logo.png')
    .trim()
    .resize({ width: size, height: size, fit: 'inside' })
    .png()
    .toBuffer()
}

const cornerMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect x="0" y="0" width="${S}" height="${S}" rx="90" ry="90" fill="#fff"/></svg>`,
)

async function save(composites, name) {
  const flat = await sharp(photoBase).composite(composites).png().toBuffer()
  await sharp(flat)
    .composite([{ input: cornerMask, blend: 'dest-in' }])
    .png()
    .toFile(`${OUT_DIR}/${name}`)
  console.log(`wrote ${OUT_DIR}/${name}`)
}

const dateText = (x, y, size = 64, spacing = 30) =>
  Buffer.from(
    `<svg width="${S}" height="${S}"><text x="${x}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${size}" letter-spacing="${spacing}" fill="#e8e6df">02.10.2026</text></svg>`,
  )

// 1. Big QR in the dark field left of the vase, logo beneath it.
{
  const q = await qr(760)
  const l = await logo(180)
  await save(
    [
      { input: q, left: 90, top: 400 },
      { input: l, left: 90 + (760 - 180) / 2, top: 1280 },
    ],
    'foto-1-stor-qr.png',
  )
}

// 2. Photo nearly untouched: small QR bottom-left, logo top-right.
{
  const q = await qr(400)
  const l = await logo(210)
  await save(
    [
      { input: q, left: 120, top: S - 400 - 120 },
      { input: l, left: S - 210 - 130, top: 110 },
    ],
    'foto-2-lille-qr.png',
  )
}

// 3. QR top-left with the release date under it, logo low in the dark left.
{
  const q = await qr(560)
  const l = await logo(170)
  await save(
    [
      { input: q, left: 140, top: 150 },
      { input: dateText(140 + 280, 860) },
      { input: l, left: 200, top: 1690 },
    ],
    'foto-3-dato.png',
  )
}

// 4. QR with the logo in a dark round badge at its center, left of the vase.
{
  const q = await qr(700)
  const badgeSize = 172
  const badge = Buffer.from(
    `<svg width="${badgeSize}" height="${badgeSize}"><circle cx="${badgeSize / 2}" cy="${badgeSize / 2}" r="${badgeSize / 2}" fill="#0a0a0c"/></svg>`,
  )
  const l = await logo(112)
  const qx = 110
  const qy = 560
  await save(
    [
      { input: q, left: qx, top: qy },
      { input: badge, left: qx + (700 - badgeSize) / 2, top: qy + (700 - badgeSize) / 2 },
      { input: l, left: qx + (700 - 112) / 2, top: qy + (700 - 112) / 2 },
    ],
    'foto-4-logobadge.png',
  )
}
