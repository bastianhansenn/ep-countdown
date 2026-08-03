// Diagnostic: visualize the cutout's alpha channel and row-span stats.
import sharp from 'sharp'

const meta = await sharp('scripts/assets/vase-cutout.png').metadata()
console.log('channels:', meta.channels, 'hasAlpha:', meta.hasAlpha)

const { data, info } = await sharp('scripts/assets/vase-cutout.png')
  .extractChannel(3)
  .raw()
  .toBuffer({ resolveWithObject: true })

let opaque = 0
for (const v of data) if (v > 200) opaque++
console.log(
  'opaque share:',
  ((opaque / data.length) * 100).toFixed(1) + '%',
  `(${info.width}x${info.height})`,
)

await sharp(data, { raw: { width: info.width, height: info.height, channels: 1 } })
  .resize({ height: 800 })
  .png()
  .toFile(process.env.SCRATCH + '/cutout-alpha.png')
console.log('wrote cutout-alpha.png')
