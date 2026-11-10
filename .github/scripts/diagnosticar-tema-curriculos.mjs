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
const persistContext=await browser.newContext({colorScheme:"light"});
const p=await persistContext.newPage();
try{
  await p.goto("https://profissionais-telessaude.vercel.app/?theme=light",{waitUntil:"domcontentloaded",timeout:35000});
  await p.waitForTimeout(900);
  const before=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,stored:localStorage.getItem("pub_profissionais_v1")?.slice(0,260)}));
  await p.locator('button[aria-label="Alternar entre tema claro e escuro"]').click();
  await p.waitForTimeout(400);
  const after=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,stored:localStorage.getItem("pub_profissionais_v1")?.slice(0,260),background:getComputedStyle(document.body).backgroundColor}));
  await p.reload({waitUntil:"domcontentloaded"});
  await p.waitForTimeout(400);
  const reload=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,stored:localStorage.getItem("pub_profissionais_v1")?.slice(0,260),background:getComputedStyle(document.body).backgroundColor}));
  console.log("THEME_TOGGLE_PERSISTENCE",JSON.stringify({before,after,reload}));
}catch(error){console.log("THEME_TOGGLE_ERROR",String(error).slice(0,350))}
await persistContext.close();
await browser.close();
