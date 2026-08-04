// Out-of-the-box sticker concepts:
//  A. The QR code IS the vase (silhouette painted inside the modules)
//  B. Inspection-hatch porthole: look INTO the lamppost, the vase is inside
//  C. Tear-off-tab flyer parody with one tab already taken
//  D. Eye chart that ends in micro text and the QR
// Output: stickers/gx-*.png at 2048x2048.
// Run: node scripts/make-genius-stickers.mjs
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

// Vase silhouette in profile units (same geometry as the 3D site vase).
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
function profileRadiusAt(profile, py) {
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
function vaseRadiusAt(y) {
  if (y <= 2.5) return profileRadiusAt(BODY_PROFILE, Math.max(0, y))
  if (y <= 2.78) return profileRadiusAt(LID_PROFILE, Math.min(0.26, y - 2.52))
  if (y <= 3.02) {
    const t = (y - 2.9) / 0.12
    return 0.13 * Math.sqrt(Math.max(0, 1 - t * t))
  }
  return 0
}

async function logoBuf(size, white = true) {
  let img = sharp('public/logo.png').trim()
  if (!white) img = img.negate({ alpha: false })
  return img.resize({ width: size, height: size, fit: 'inside' }).png().toBuffer()
}

// ---- A. The QR code IS the vase ----
{
  const qr = QRCode.create(URL, { errorCorrectionLevel: 'H' })
  const N = qr.modules.size
  const getM = (r, c) => qr.modules.get(r, c)
  const QSIZE = 1560
  const cell = QSIZE / N
  const rTop = 0.06 * N
  const rBot = 0.97 * N
  const scale = (rBot - rTop) / 3.02 // rows per profile unit
  const inside = (r, c) => {
    const y = (rBot - r) / scale
    const x = (c - N / 2) / scale
    return Math.abs(x) <= vaseRadiusAt(y)
  }
  let rects = ''
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!getM(r, c)) continue
      const fill = inside(r + 0.5, c + 0.5) ? '#2447c9' : '#10152e'
      rects += `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${(cell + 0.35).toFixed(2)}" height="${(cell + 0.35).toFixed(2)}" fill="${fill}"/>`
    }
  }
  const qrSvg = Buffer.from(`<svg width="${QSIZE}" height="${QSIZE}">${rects}</svg>`)
  const disc = 330
  const ring = 380
  const l = await logoBuf(200)
  const badge = Buffer.from(
    `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${PORC}"/><circle cx="${ring / 2}" cy="${ring / 2}" r="${disc / 2}" fill="${NAVY}"/></svg>`,
  )
  const caption = Buffer.from(
    `<svg width="${S}" height="${S}"><text x="${S / 2}" y="1932" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="58" letter-spacing="26" fill="${NAVY}">02.10.2026</text></svg>`,
  )
  await save(
    solid(PORC),
    [
      { input: await sharp(qrSvg).png().toBuffer(), left: (S - QSIZE) / 2, top: 190 },
      { input: badge, left: (S - ring) / 2, top: 190 + (QSIZE - ring) / 2 },
      { input: l, left: (S - 200) / 2, top: 190 + (QSIZE - 200) / 2 },
      { input: caption },
    ],
    'gx-1-qr-er-vasen.png',
  )
}

// ---- B. Inspection hatch: the vase lives inside the lamppost ----
{
  const CX = S / 2
  const CY = 880
  const R = 660
  const porthole = Buffer.from(
    `<svg width="${S}" height="${S}">
      <defs>
        <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e6e8ec"/>
          <stop offset="45%" stop-color="#9aa0ab"/>
          <stop offset="100%" stop-color="#4c515b"/>
        </linearGradient>
        <radialGradient id="depth">
          <stop offset="0%" stop-color="#101726"/>
          <stop offset="70%" stop-color="#05070c"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <radialGradient id="innerGlow">
          <stop offset="0%" stop-color="#2a52c8" stop-opacity="0.5"/>
          <stop offset="60%" stop-color="#1a3fa0" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#1a3fa0" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="${CX}" cy="${CY}" r="${R + 74}" fill="url(#rim)"/>
      <circle cx="${CX}" cy="${CY}" r="${R + 74}" fill="none" stroke="#2c2f35" stroke-width="6"/>
      <circle cx="${CX}" cy="${CY}" r="${R + 10}" fill="none" stroke="#33363c" stroke-width="20"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#depth)"/>
      <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#innerGlow)"/>
      ${[45, 135, 225, 315]
        .map((a) => {
          const x = CX + Math.cos((a * Math.PI) / 180) * (R + 42)
          const y = CY + Math.sin((a * Math.PI) / 180) * (R + 42)
          return `<circle cx="${x}" cy="${y}" r="26" fill="#c9ccd2" stroke="#54575e" stroke-width="4"/><line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#54575e" stroke-width="6" transform="rotate(${a} ${x} ${y})"/>`
        })
        .join('')}
    </svg>`,
  )
  const vase = await sharp('stickers/float-2-hjoerne.png')
    .extract({ left: 840, top: 290, width: 620, height: 1280 })
    .resize({ height: 880 })
    .png()
    .toBuffer()
  const vm = await sharp(vase).metadata()
  const vMask = await sharp(
    Buffer.from(
      `<svg width="${vm.width}" height="${vm.height}"><rect x="20" y="20" width="${vm.width - 40}" height="${vm.height - 40}" rx="120" fill="#fff"/></svg>`,
    ),
  )
    .blur(18)
    .png()
    .toBuffer()
  const vaseBlob = await sharp(vase)
    .composite([{ input: vMask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const glass = Buffer.from(
    `<svg width="${S}" height="${S}"><defs><linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0"/><stop offset="42%" stop-color="#ffffff" stop-opacity="0"/><stop offset="50%" stop-color="#ffffff" stop-opacity="0.14"/><stop offset="58%" stop-color="#ffffff" stop-opacity="0"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></linearGradient><clipPath id="c"><circle cx="${CX}" cy="${CY}" r="${R}"/></clipPath></defs><rect width="${S}" height="${S}" fill="url(#sheen)" clip-path="url(#c)"/></svg>`,
  )
  const label = Buffer.from(
    `<svg width="${S}" height="${S}">
      <text x="${S / 2}" y="1808" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="64" letter-spacing="22" fill="#c9ccd2">INSPEKTIONSLUGE 7B</text>
      <text x="${S / 2}" y="1902" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="52" letter-spacing="16" fill="#7c8089">AABNES 02.10.2026</text>
    </svg>`,
  )
  const qsvg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 1,
    color: { dark: '#0d1330', light: '#f4f2ec' },
  })
  const q = await sharp(Buffer.from(qsvg)).resize(260, 260, { kernel: 'nearest' }).png().toBuffer()
  await save(
    solid(BLACK),
    [
      { input: porthole },
      { input: vaseBlob, left: Math.round(CX - vm.width / 2), top: Math.round(CY - 440) },
      { input: glass },
      { input: label },
      { input: q, left: S - 260 - 130, top: S - 260 - 130 },
    ],
    'gx-2-inspektionsluge.png',
  )
}

// ---- C. Tear-off-tab flyer with one tab taken ----
{
  const bq = await (async () => {
    const qsvg = await QRCode.toString(URL, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 0,
      color: { dark: NAVY, light: '#00000000' },
    })
    const q = await sharp(Buffer.from(qsvg)).resize(560, 560, { kernel: 'nearest' }).png().toBuffer()
    const disc = 134
    const ring = 156
    const l = await logoBuf(84)
    const badge = Buffer.from(
      `<svg width="${ring}" height="${ring}"><circle cx="${ring / 2}" cy="${ring / 2}" r="${ring / 2}" fill="${PORC}"/><circle cx="${ring / 2}" cy="${ring / 2}" r="${disc / 2}" fill="${NAVY}"/></svg>`,
    )
    return sharp({ create: { width: 560, height: 560, channels: 4, background: '#0000' } })
      .composite([
        { input: q },
        { input: badge, left: (560 - 156) / 2, top: (560 - 156) / 2 },
        { input: l, left: (560 - 84) / 2, top: (560 - 84) / 2 },
      ])
      .png()
      .toBuffer()
  })()
  const logo = await logoBuf(300, false)
  const TABS = 7
  const tabW = Math.floor((S - 200) / TABS)
  const tabTop = 1470
  const tabH = 430
  const missing = 2
  let tabs = ''
  for (let i = 0; i < TABS; i++) {
    const x = 100 + i * tabW
    if (i === missing) {
      tabs += `<path d="M${x + 8},${tabTop + 6} L${x + tabW - 8},${tabTop + 4} L${x + tabW - 14},${tabTop + 40} L${x + 10},${tabTop + 52} Z" fill="#d9d5c8"/>`
      continue
    }
    tabs += `
      <rect x="${x + 6}" y="${tabTop}" width="${tabW - 12}" height="${tabH}" fill="${PORC}" stroke="${NAVY}" stroke-width="3" stroke-dasharray="14 10"/>
      <text x="${x + tabW / 2 + 14}" y="${tabTop + tabH / 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="46" letter-spacing="6" fill="${NAVY}" transform="rotate(-90 ${x + tabW / 2} ${tabTop + tabH / 2})">atte.one</text>`
  }
  const sheet = Buffer.from(
    `<svg width="${S}" height="${S}">
      <text x="${S / 2}" y="360" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="120" letter-spacing="4" fill="${NAVY}">TAG EN. DEN VIRKER</text>
      <text x="${S / 2}" y="500" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="120" letter-spacing="4" fill="${NAVY}">FRA 02.10.2026</text>
      <line x1="100" y1="${tabTop}" x2="${S - 100}" y2="${tabTop}" stroke="${NAVY}" stroke-width="4" stroke-dasharray="16 12"/>
      ${tabs}
    </svg>`,
  )
  await save(
    solid(PORC),
    [
      { input: sheet },
      { input: bq, left: (S - 560) / 2, top: 700 },
      { input: logo, left: 170, top: 640 },
    ],
    'gx-3-riv-en-flig.png',
  )
}

// ---- D. Eye chart ----
{
  const rows = [
    ['A', 340, '6/60'],
    ['T T E', 230, '6/36'],
    ['0 2 1 0', 150, '6/24'],
    ['2 0 2 6', 104, '6/18'],
    ['A T T E . O N E', 66, '6/12'],
    ['SCAN NAAR DU ER TAET NOK', 38, '6/9'],
    ['ER DU TAET NOK TIL AT LAESE DETTE KAN DU OGSAA SCANNE', 22, '6/6'],
  ]
  let y = 330
  let rowSvg = ''
  for (const [text, size, acuity] of rows) {
    rowSvg += `<text x="${S / 2}" y="${y}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size}" letter-spacing="${Math.max(4, size * 0.22)}" fill="${NAVY}">${text}</text>`
    rowSvg += `<text x="${S - 150}" y="${y - size * 0.3}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#9a978c">${acuity}</text>`
    rowSvg += `<line x1="150" y1="${y + 44}" x2="${S - 150}" y2="${y + 44}" stroke="#d8d4c6" stroke-width="2"/>`
    y += size + 118
  }
  const chart = Buffer.from(
    `<svg width="${S}" height="${S}">
      <text x="150" y="180" font-family="Arial, Helvetica, sans-serif" font-size="44" letter-spacing="10" fill="#9a978c">SYNSPROEVE</text>
      ${rowSvg}
    </svg>`,
  )
  const qsvg = await QRCode.toString(URL, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 0,
    color: { dark: NAVY, light: '#00000000' },
  })
  const q = await sharp(Buffer.from(qsvg)).resize(330, 330, { kernel: 'nearest' }).png().toBuffer()
  await save(
    solid(PORC),
    [
      { input: chart },
      { input: q, left: 160, top: 1470 },
    ],
    'gx-4-synsproeve.png',
  )
}
