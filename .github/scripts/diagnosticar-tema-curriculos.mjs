import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
for(const color of ["light","dark"]){
  const ctx=await browser.newContext({colorScheme:color,viewport:{width:1200,height:820}});
  for(const suffix of ["?theme=light","?theme=dark",""]){
    const page=await ctx.newPage();
    const target="https://profissionais-telessaude.vercel.app/"+suffix;
    try{
      const response=await page.goto(target,{waitUntil:"domcontentloaded",timeout:35000});
      await page.waitForTimeout(3000);
      const d=await page.evaluate(()=>{
        const style=(e)=>{if(!e)return null;const c=getComputedStyle(e);return {background:c.backgroundColor,color:c.color,classes:e.className,id:e.id}};
        let themeCandidates=[...document.querySelectorAll("[data-theme],[class*=dark],[class*=light],button")].slice(0,8);
        return {
          title:document.title,url:location.href,
          html:{theme:document.documentElement.dataset.theme,mode:document.documentElement.className,style:style(document.documentElement)},
          body:style(document.body),main:style(document.querySelector("main")),
          h1:document.querySelector("h1")?.textContent?.slice(0,160),
          snippets:document.body?.innerText?.slice(0,220),
          storageKeys:Object.keys(localStorage),
          widgets:themeCandidates.map(x=>({tag:x.tagName,name:x.getAttribute("aria-label"),text:x.textContent?.trim().slice(0,50),cls:x.className}))
        };
      });
      console.log("THEME_DIAGNOSTIC",JSON.stringify({color,suffix,status:response?.status(),...d}));
    }catch(error){
      console.log("THEME_ERROR",JSON.stringify({color,suffix,target,error:String(error).slice(0,300)}));
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
