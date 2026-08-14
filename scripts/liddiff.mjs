// Measures how much the lid sprite differs from the background region it
// covers on screen (alpha-weighted). Nonzero diff = visible editing mark.
import sharp from 'sharp'

const bg = await sharp('public/background.jpg').raw().toBuffer({ resolveWithObject: true })
const lid = await sharp('public/evening-lid.png').raw().toBuffer({ resolveWithObject: true })
const W = bg.info.width
const H = bg.info.height
const LID = { x0: 0.4608, x1: 0.5408, y0: 0.327, y1: 0.393 }
const lx = Math.round(LID.x0 * W)
const ly = Math.round(LID.y0 * H)
const lw = lid.info.width
const lh = lid.info.height
const cb = bg.info.channels
const cl = lid.info.channels

let maxCore = 0
let sumCore = 0
let nCore = 0
let maxFeather = 0
for (let y = 0; y < lh; y++) {
  for (let x = 0; x < lw; x++) {
    const bi = ((ly + y) * W + (lx + x)) * cb
    const li = (y * lw + x) * cl
    const a = cl === 4 ? lid.data[li + 3] : 255
    const d = Math.max(
      Math.abs(bg.data[bi] - lid.data[li]),
      Math.abs(bg.data[bi + 1] - lid.data[li + 1]),
      Math.abs(bg.data[bi + 2] - lid.data[li + 2]),
    )
    if (a === 255) {
      maxCore = Math.max(maxCore, d)
      sumCore += d
      nCore++
    } else if (a > 0) {
      maxFeather = Math.max(maxFeather, d)
    }
  }
}
console.log(JSON.stringify({
  spriteSize: `${lw}x${lh}`,
  coreMaxDiff: maxCore,
  coreMeanDiff: +(sumCore / nCore).toFixed(2),
  featherMaxDiff: maxFeather,
}))
