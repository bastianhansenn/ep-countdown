// Freestyle sticker concepts for ATTE:
//  A. "HAR DU SET DENNE VASE?" missing-poster parody
//  B. Broken porcelain shard carrying the QR
//  C. Floating vase with a blue glow and the date
// Output: stickers/fs-*.png at 2048x2048.
// Run: node scripts/make-freestyle-stickers.mjs
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

// The floating vase (arm already removed) cropped from the finished sticker.
const vaseCrop = await sharp('stickers/float-2-hjoerne.png')
  .extract({ left: 840, top: 290, width: 620, height: 1280 })
  .png()
  .toBuffer()

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

// ---- A. Missing-poster parody ----
{
  const headline = Buffer.from(
    `<svg width="${S}" height="${S}">
      <text x="${S / 2}" y="235" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="168" letter-spacing="6" fill="${NAVY}">HAR DU SET</text>
      <text x="${S / 2}" y="425" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="168" letter-spacing="6" fill="${NAVY}">DENNE VASE?</text>
      <text x="1330" y="1852" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="60" letter-spacing="16" fill="${NAVY}">SIDST SET: 02.10.2026</text>
    </svg>`,
  )
  const panelW = 560
  const panelH = 1160
  const panel = await sharp(vaseCrop)
    .resize(panelW, panelH, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${panelW}" height="${panelH}"><rect width="${panelW}" height="${panelH}" rx="42" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer()
  const keyline = Buffer.from(
    `<svg width="${panelW + 20}" height="${panelH + 20}"><rect x="5" y="5" width="${panelW + 10}" height="${panelH + 10}" rx="48" fill="none" stroke="${NAVY}" stroke-width="5"/></svg>`,
  )
  const bq = await badgedQr(400)
  await save(
    solid(PORC),
    [
      { input: headline },
      { input: keyline, left: (S - panelW) / 2 - 10, top: 520 - 10 },
      { input: panel, left: (S - panelW) / 2, top: 520 },
      { input: bq, left: 190, top: 1560 },
    ],
    'fs-1-efterlysning.png',
  )
}

// ---- B. Porcelain shard with the QR ----
{
  const SH = 1250
  const shardPath =
    'M640,40 L1130,300 L1210,760 L890,1180 L420,1090 L210,620 L370,220 Z'
  const texture = await sharp('public/vase-body.png')
    .extract({ left: 300, top: 300, width: 1250, height: 1250 })
    .modulate({ brightness: 1.05 })
    .png()
    .toBuffer()
  const shardMask = Buffer.from(
    `<svg width="${SH}" height="${SH}"><path d="${shardPath}" fill="#fff"/></svg>`,
  )
  const shardEdge = Buffer.from(
    `<svg width="${SH}" height="${SH}"><path d="${shardPath}" fill="none" stroke="#fdfdf8" stroke-width="10" stroke-linejoin="round"/><path d="${shardPath}" fill="none" stroke="#00000066" stroke-width="3"/></svg>`,
  )
  const patch = Buffer.from(
    `<svg width="620" height="620"><rect width="620" height="620" rx="36" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(520)
  const shard = await sharp(texture)
    .composite([
      { input: shardMask, blend: 'dest-in' },
      { input: patch, left: 400, top: 340 },
      { input: bq, left: 450, top: 390 },
      { input: shardEdge },
    ])
    .png()
    .toBuffer()
  const shardMasked = await sharp(shard)
    .composite([{ input: shardMask, blend: 'dest-in' }])
    .rotate(7, { background: '#00000000' })
    .png()
    .toBuffer()

  // Small scattered fragments.
  async function fragment(size, points, texLeft, texTop, angle) {
    const m = Buffer.from(
      `<svg width="${size}" height="${size}"><path d="${points}" fill="#fff"/></svg>`,
    )
    const e = Buffer.from(
      `<svg width="${size}" height="${size}"><path d="${points}" fill="none" stroke="#fdfdf8" stroke-width="7" stroke-linejoin="round"/></svg>`,
    )
    const t = await sharp('public/vase-body.png')
      .extract({ left: texLeft, top: texTop, width: size, height: size })
      .png()
      .toBuffer()
    return sharp(t)
      .composite([{ input: m, blend: 'dest-in' }, { input: e }])
      .png()
      .toBuffer()
      .then((b) => sharp(b).composite([{ input: m, blend: 'dest-in' }]).rotate(angle, { background: '#00000000' }).png().toBuffer())
  }
  const glow = Buffer.from(
    `<svg width="1800" height="1800"><defs><radialGradient id="g"><stop offset="0%" stop-color="#2a4faf" stop-opacity="0.5"/><stop offset="60%" stop-color="#16306e" stop-opacity="0.2"/><stop offset="100%" stop-color="#16306e" stop-opacity="0"/></radialGradient></defs><circle cx="900" cy="900" r="900" fill="url(#g)"/></svg>`,
  )
  const f1 = await fragment(300, 'M150,20 L280,180 L90,270 L30,110 Z', 700, 1500, -14)
  const f2 = await fragment(240, 'M120,15 L225,120 L150,225 L20,150 Z', 1500, 500, 22)
  const f3 = await fragment(200, 'M100,10 L190,120 L60,185 L15,80 Z', 200, 900, -30)
  await save(
    solid(BLACK),
    [
      { input: glow, left: 130, top: 60 },
      { input: shardMasked, left: 330, top: 240 },
      { input: f1, left: 1560, top: 1360 },
      { input: f2, left: 260, top: 1560 },
      { input: f3, left: 1620, top: 300 },
    ],
    'fs-2-skaar.png',
  )
}

// ---- C. Glowing vase with the date ----
{
  const glow = Buffer.from(
    `<svg width="1700" height="1900"><defs><radialGradient id="g"><stop offset="0%" stop-color="#0a0a0d" stop-opacity="0"/><stop offset="42%" stop-color="#12266a" stop-opacity="0.08"/><stop offset="62%" stop-color="#2a52c8" stop-opacity="0.5"/><stop offset="82%" stop-color="#1a3fa0" stop-opacity="0.18"/><stop offset="100%" stop-color="#1a3fa0" stop-opacity="0"/></radialGradient></defs><ellipse cx="850" cy="950" rx="850" ry="950" fill="url(#g)"/></svg>`,
  )
  const vaseSoft = await sharp(vaseCrop)
    .resize({ height: 1330 })
    .png()
    .toBuffer()
  const vm = await sharp(vaseSoft).metadata()
  const softMask = await sharp(
    Buffer.from(
      `<svg width="${vm.width}" height="${vm.height}"><rect x="26" y="26" width="${vm.width - 52}" height="${vm.height - 52}" rx="160" fill="#fff"/></svg>`,
    ),
  )
    .blur(22)
    .png()
    .toBuffer()
  const vaseBlob = await sharp(vaseSoft)
    .composite([{ input: softMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const date = Buffer.from(
    `<svg width="${S}" height="${S}"><text x="${S / 2}" y="248" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="86" letter-spacing="46" fill="#e8e6df">02.10.2026</text></svg>`,
  )
  const plate = Buffer.from(
    `<svg width="470" height="470"><rect width="470" height="470" rx="38" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(386)
  await save(
    solid(BLACK),
    [
      { input: glow, left: Math.round(S / 2 - 850), top: 120 },
      { input: vaseBlob, left: Math.round((S - vm.width) / 2), top: 330 },
      { input: date },
      { input: plate, left: S - 470 - 150, top: S - 470 - 150 },
      { input: bq, left: S - 470 - 150 + 42, top: S - 470 - 150 + 42 },
    ],
    'fs-3-gloed.png',
  )
}
