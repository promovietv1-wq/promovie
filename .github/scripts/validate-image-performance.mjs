import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const pages=[
 {url:'/conecta-gestao/',path:'conecta-gestao/index.html',kind:'mosaic',count:12},
 {url:'/experiencia/',path:'experiencia/index.html',kind:'mosaic',count:12},
 {url:'/audiovisual/',path:'audiovisual/index.html',kind:'gallery',count:27}
];
for(const entry of pages){
 const source=await readFile(entry.path,'utf8');
 const urls=[...source.matchAll(/src="([^"]+)"/g)].map(x=>x[1]).filter(url=>url.startsWith('/audiovisual/thumbs/')&&url.endsWith('.webp'));
 assert.equal(urls.length,entry.count,entry.url+' deve servir miniaturas locais');
 for(const url of urls){
  const image=await readFile('.'+url);
  assert.ok(image.byteLength>400,entry.url+' miniatura vazia '+url);
 }
 if(entry.kind==='mosaic'){
  assert.equal((source.match(/<video[^>]+preload="none"/g)||[]).length,3);
  assert.equal((source.match(/class="pvTwelveShot"><img[^>]+loading="eager"/g)||[]).length,12);
 }
}
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:840}});
  for(const entry of pages){
   const page=await context.newPage();
   const errors=[]; page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:8779'+entry.url,{waitUntil:'domcontentloaded'});
   const selector=entry.kind==='mosaic'?'.pvTwelveShot img':'.workGrid .work .media img';
   assert.equal(await page.locator(selector).count(),entry.count);
   await page.locator(selector).first().scrollIntoViewIfNeeded();
   await page.waitForFunction(({selector,count})=>{
    const images=[...document.querySelectorAll(selector)];
    return images.length===count&&images.slice(0,count===27?6:count).every(img=>img.complete&&img.naturalWidth>0);
   },{selector,count:entry.count},{timeout:15000});
   const state=await page.locator(selector).evaluateAll(imgs=>imgs.map(i=>({
    loaded:i.complete&&i.naturalWidth>0,url:i.currentSrc.split('/').pop(),
    originalWidth:i.naturalWidth,originalHeight:i.naturalHeight
   })));
   assert.ok(state.slice(0,entry.count===27?6:entry.count).every(x=>x.loaded),entry.url);
   assert.deepEqual(errors,[],entry.url+' erro JavaScript');
   if(entry.kind==='mosaic')assert.equal(await page.locator('video[preload="auto"]').count(),0);
   console.log('PASS',entry.url,'viewport',width,'local thumbnails',state.filter(x=>x.loaded).length);
   await page.close();
  }
  for(const url of ['/','/app/']){
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:8779'+url,{waitUntil:'domcontentloaded'});
   assert.ok(await page.title());
   console.log('PASS smoke page',url,'viewport',width);
   await page.close();
  }
  await context.close();
 }
}finally{await browser.close()}
