// Prepares the professional street photo as the site backdrop, untouched
// (daylight; the evening/night grade is a later step). Only resized: the
// 4240px original exceeds the 4096px WebGL texture limit on many phones,
// and the backdrop lives as a texture inside the scene so the glass can
// refract it. Source: scripts/assets/street-pro.jpg -> public/background.jpg
// Run: node scripts/make-background.mjs
import sharp from 'sharp'

const SRC = 'scripts/assets/street-pro.jpg'
const OUT = 'public/background.jpg'
const TARGET_W = 3600

const info = await sharp(SRC)
  .resize({ width: TARGET_W, kernel: 'lanczos3' })
  .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
  .toFile(OUT)
console.log(`wrote ${OUT} (${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB)`)
