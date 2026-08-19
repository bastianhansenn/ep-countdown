// Screenshots the live site (WebGL 3D scene included) headlessly, so the
// composite of backdrop + animated vase can actually be inspected.
// Usage: node scripts/shoot.mjs [url] [outName] [width] [height]
import puppeteer from 'puppeteer'

const url = process.argv[2] || 'http://localhost:5210/'
const outName = process.argv[3] || 'shot'
const width = Number(process.argv[4] || 1440)
const height = Number(process.argv[5] || 900)
const SP =
  'C:/Users/basti/AppData/Local/Temp/claude/C--Users-basti-OneDrive-Documents-GitHub-ProReach/84e84cf5-8c45-435b-b3ec-b99ae747f174/scratchpad/'

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ],
})
const page = await browser.newPage()
await page.setViewport({ width, height, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 })
// silence the audio player and let the scene draw a few real frames
await page.evaluate(() => localStorage.setItem('atte-muted', '1'))
await page.reload({ waitUntil: 'networkidle0', timeout: 60000 })
await new Promise((r) => setTimeout(r, 4000))
const info = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'))
  let px = null
  if (gl) {
    const p = new Uint8Array(4)
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p)
    px = [...p]
  }
  return {
    canvas: !!c,
    canvasSize: c ? [c.width, c.height] : null,
    centerPixel: px,
    mainOpacity: getComputedStyle(document.querySelector('main')).opacity,
  }
})
await page.screenshot({ path: SP + outName + '.png' })
console.log(JSON.stringify({ info, errors: errors.slice(0, 8) }, null, 2))
await browser.close()
