import puppeteer from 'puppeteer'
const url = process.argv[2]
const browser = await puppeteer.launch({headless:true,args:['--disable-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const page = await browser.newPage()
const logs=[]
page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', r => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))
page.on('response', r => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`) })
await page.goto(url, {waitUntil:'networkidle0', timeout:60000})
await new Promise(r=>setTimeout(r,4000))
const dom = await page.evaluate(() => ({
  hasMain: !!document.querySelector('main'),
  rootHTML: (document.getElementById('root')?.innerHTML || '').slice(0,200),
  bodyText: document.body.innerText.slice(0,120),
}))
console.log(JSON.stringify({dom, logs: logs.slice(0,15)}, null, 2))
await browser.close()
