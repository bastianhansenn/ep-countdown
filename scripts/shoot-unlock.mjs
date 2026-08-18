import puppeteer from 'puppeteer'
const SP='C:/Users/basti/AppData/Local/Temp/claude/C--Users-basti-OneDrive-Documents-GitHub-ProReach/84e84cf5-8c45-435b-b3ec-b99ae747f174/scratchpad/'
const [,,url,out,w,h]=process.argv
const browser=await puppeteer.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']})
const page=await browser.newPage()
await page.setViewport({width:Number(w),height:Number(h)})
await page.goto(url,{waitUntil:'networkidle0',timeout:60000})
await page.evaluate(()=>localStorage.setItem('atte-muted','1'))
await page.reload({waitUntil:'networkidle0',timeout:60000})
await new Promise(r=>setTimeout(r,3500))
const btn=await page.$('button')
const buttons=await page.$$('button')
// click the unlock button (the wide one, not the mute toggle)
for(const b of buttons){const box=await b.boundingBox();if(box&&box.width>150){await b.click();break}}
await new Promise(r=>setTimeout(r,2500))
const text=await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').trim())
await page.screenshot({path:SP+out+'.png'})
console.log(JSON.stringify({text:text.slice(0,90)}))
await browser.close()
