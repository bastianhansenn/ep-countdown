// Builds the tab icon from the white transparent Ashira logo: trimmed to
// content, padded, and composited onto a black square so it is visible on
// both light and dark browser chrome.
// Run: node scripts/make-favicon.mjs
import sharp from 'sharp'

const SRC = 'public/logo.png'

async function makeIcon(size, out) {
  const inner = Math.round(size * 0.78)
  const logo = await sharp(SRC).trim().resize({
    width: inner,
    height: inner,
    fit: 'inside',
  }).png().toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#000000',
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(out)
  console.log(`wrote ${out}`)
}

await makeIcon(512, 'public/favicon.png')
await makeIcon(180, 'public/apple-touch-icon.png')
