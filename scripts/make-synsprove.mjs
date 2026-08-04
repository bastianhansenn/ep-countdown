// The chosen concept, finalized: the ATTE eye chart with proper Danish
// (ae/oe/aa glyphs), the Ashira logo badge inside the QR, in four variants.
// Output: stickers/syn-*.png at 2048x2048.
// Run: node scripts/make-synsprove.mjs
import sharp from 'sharp'
import QRCode from 'qrcode'

const S = 2048
const URL = 'https://atte.one'
const NAVY = '#021150'
const PORC = '#f4f2ec'
const BLACK = '#0a0a0d'
const COBALT = '#2447c9'

const cornerMask = Buffer.from(
  `<svg width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="90" ry="90" fill="#fff"/></svg>`,
)
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

async function logoBuf(size, variant = 'white') {
  let img = sharp('public/logo.png').trim()
  if (variant === 'black') img = img.negate({ alpha: false })
  return img.resize({ width: size, height: size, fit: 'inside' }).png().toBuffer()
}

// Badged QR: modules in `dark`, logo disc in navy, clearing ring in `ring`.
async function badgedQr(size, dark, ringColor) {
  const qsvg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark, light: '#00000000' },
  })
  const q = await sharp(Buffer.from(qsvg)).resize(size, size, { kernel: 'nearest' }).png().toBuffer()
  const disc = Math.round(size * 0.24)
  const ring = Math.round(disc * 1.16)
  const logoSize = Math.round(disc * 0.62)
  const l = await logoBuf(logoSize)
  const ringSvg = Buffer.from(
    `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${ringColor}"/></svg>`,
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

const ROWS = [
  ['A', 340, '6/60'],
  ['T T E', 230, '6/36'],
  ['0 2 1 0', 150, '6/24'],
  ['2 0 2 6', 104, '6/18'],
  ['A T T E . O N E', 66, '6/12'],
  ['SCAN NÅR DU ER TÆT NOK', 38, '6/9'],
  ['ER DU TÆT NOK TIL AT LÆSE DETTE KAN DU OGSÅ SCANNE', 22, '6/6'],
]

function chartSvg({ ink, faint, rule, header = 'SYNSPRØVE', startY = 330, gap = 118 }) {
  let y = startY
  let out = `<text x="150" y="180" font-family="Arial, Helvetica, sans-serif" font-size="44" letter-spacing="10" fill="${faint}">${header}</text>`
  for (const [text, size, acuity] of ROWS) {
    out += `<text x="${S / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" letter-spacing="${Math.max(4, size * 0.22)}" fill="${ink}">${text}</text>`
    out += `<text x="${S - 150}" y="${y - size * 0.3}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="${faint}">${acuity}</text>`
    out += `<line x1="150" y1="${y + 44}" x2="${S - 150}" y2="${y + 44}" stroke="${rule}" stroke-width="2"/>`
    y += size + gap
  }
  return out
}

// 1. Classic porcelain chart.
{
  const chart = Buffer.from(
    `<svg width="${S}" height="${S}">${chartSvg({ ink: NAVY, faint: '#9a978c', rule: '#d8d4c6' })}</svg>`,
  )
  const bq = await badgedQr(330, NAVY, PORC)
  await save(solid(PORC), [{ input: chart }, { input: bq, left: 160, top: 1470 }], 'syn-1-klassisk.png')
}

// 2. Night version: black chart, porcelain letters.
{
  const chart = Buffer.from(
    `<svg width="${S}" height="${S}">${chartSvg({ ink: PORC, faint: '#6d7077', rule: '#2a2c31' })}</svg>`,
  )
  const plate = Buffer.from(
    `<svg width="410" height="410"><rect width="410" height="410" rx="34" fill="${PORC}"/></svg>`,
  )
  const bq = await badgedQr(330, NAVY, PORC)
  await save(
    solid(BLACK),
    [{ input: chart }, { input: plate, left: 160, top: 1440 }, { input: bq, left: 200, top: 1480 }],
    'syn-2-sort.png',
  )
}

// 3. Duochrome version: the optician's red/green test carries the date.
{
  const rows = [
    ['A', 320, '6/60'],
    ['T T E', 210, '6/36'],
    ['2 0 2 6', 130, '6/24'],
    ['A T T E . O N E', 64, '6/12'],
  ]
  let y = 300
  let rowSvg = `<text x="150" y="170" font-family="Arial, Helvetica, sans-serif" font-size="44" letter-spacing="10" fill="#9a978c">SYNSPRØVE</text>`
  for (const [text, size, acuity] of rows) {
    rowSvg += `<text x="${S / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" letter-spacing="${Math.max(4, size * 0.22)}" fill="${NAVY}">${text}</text>`
    rowSvg += `<text x="${S - 150}" y="${y - size * 0.3}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#9a978c">${acuity}</text>`
    rowSvg += `<line x1="150" y1="${y + 40}" x2="${S - 150}" y2="${y + 40}" stroke="#d8d4c6" stroke-width="2"/>`
    y += size + 100
  }
  const bandY = y - 20
  rowSvg += `
    <rect x="${S / 2 - 330}" y="${bandY}" width="330" height="130" fill="#b23a3a"/>
    <rect x="${S / 2}" y="${bandY}" width="330" height="130" fill="#2a7a4b"/>
    <text x="${S / 2 - 165}" y="${bandY + 92}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="76" letter-spacing="14" fill="#ffffff">02</text>
    <text x="${S / 2 + 165}" y="${bandY + 92}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="76" letter-spacing="14" fill="#ffffff">10</text>
    <text x="${S / 2}" y="${bandY + 240}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" letter-spacing="12" fill="${NAVY}">ER DU TÆT NOK TIL AT LÆSE DETTE KAN DU OGSÅ SCANNE</text>`
  const chart = Buffer.from(`<svg width="${S}" height="${S}">${rowSvg}</svg>`)
  const bq = await badgedQr(300, NAVY, PORC)
  await save(
    solid(PORC),
    [{ input: chart }, { input: bq, left: (S - 300) / 2, top: bandY + 300 }],
    'syn-3-duokrom.png',
  )
}

// 4. Optician's card: framed, small logo, appointment line.
{
  let y = 500
  let rowSvg = ''
  const rows = [
    ['A', 270, '6/60'],
    ['T T E', 180, '6/36'],
    ['0 2 1 0', 118, '6/24'],
    ['2 0 2 6', 82, '6/18'],
    ['A T T E . O N E', 52, '6/12'],
    ['SCAN NÅR DU ER TÆT NOK', 32, '6/9'],
    ['ER DU TÆT NOK TIL AT LÆSE DETTE KAN DU OGSÅ SCANNE', 20, '6/6'],
  ]
  for (const [text, size, acuity] of rows) {
    rowSvg += `<text x="${S / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" letter-spacing="${Math.max(4, size * 0.22)}" fill="${NAVY}">${text}</text>`
    rowSvg += `<text x="${S - 230}" y="${y - size * 0.3}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#9a978c">${acuity}</text>`
    rowSvg += `<line x1="230" y1="${y + 36}" x2="${S - 230}" y2="${y + 36}" stroke="#d8d4c6" stroke-width="2"/>`
    y += size + 78
  }
  const frame = Buffer.from(
    `<svg width="${S}" height="${S}">
      <rect x="120" y="120" width="${S - 240}" height="${S - 240}" fill="none" stroke="${NAVY}" stroke-width="8"/>
      <rect x="146" y="146" width="${S - 292}" height="${S - 292}" fill="none" stroke="${NAVY}" stroke-width="2"/>
      <text x="${S / 2}" y="245" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" letter-spacing="20" fill="#9a978c">AUTORISERET SYNSPRØVE</text>
      ${rowSvg}
      <text x="${S / 2}" y="1872" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" letter-spacing="14" fill="${NAVY}">NÆSTE LEDIGE TID: 02.10.2026</text>
    </svg>`,
  )
  const logo = await logoBuf(150, 'black')
  const bq = await badgedQr(300, NAVY, PORC)
  await save(
    solid(PORC),
    [
      { input: frame },
      { input: logo, left: 230, top: 210 },
      { input: bq, left: 230, top: 1500 },
    ],
    'syn-4-optiker.png',
  )
}
