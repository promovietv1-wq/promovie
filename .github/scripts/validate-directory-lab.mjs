import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const portal=await readFile("telesaude/index.html","utf8");
const normal=await readFile("telesaude/atendimento/index.html","utf8");
const testPage=await readFile("telesaude/atendimento-teste/index.html","utf8");
assert.match(portal,/directoryTest=new URLSearchParams\(location.search\).get\("teste"\)==="profissionais"/);
assert.match(portal,/window.location.assign\("\/telesaude\/atendimento\/"\)/);
assert.match(portal,/window.location.assign\("\/telesaude\/atendimento-teste\/"\)/);
assert.doesNotMatch(normal,/directory-open|diretorio-teste|directoryToken/);
assert.match(testPage,/const SDK_SOURCE="https:\/\/widget\.mediquo\.com\/js\/1\.0\.0\/mediquo\.js"/);
assert.match(testPage,/widget\.init\(/);
assert.match(testPage,/widget\.open\(\)/);
assert.match(testPage,/id="directory-open"/);
assert.match(testPage,/\/telesaude\/diretorio-teste\.mjs/);
assert.match(testPage,/\/telesaude\/" id="back-access"/);
const browser=await chromium.launch({headless:true});
const people=[
  {id:"p01",name:"Beatriz Exemplo",title:"General Medicine"},
  {id:"p02",name:"Ana Exemplo",title:"Psychology"},
  {id:"p03",name:"Carlos Exemplo",title:"Nutrition"},
  {id:"p04",name:"Davi Exemplo",title:"Pediatrics"}
];
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:820}});
  await page.goto("http://127.0.0.1:8779/telesaude/atendimento-teste/",{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator("#directory-open").isHidden(),true);
  const active=await page.evaluate(async people=>{
    const frame=document.createElement("iframe");frame.id="MediquoContainer";
    frame.src="about:blank";document.body.append(frame);
    const sdk={
      navigate(path){
        window.__navigation=path;
        const profile=path.match(/\/professionals\/([^/]+)\/room$/);
        if(profile){
          setTimeout(()=>window.dispatchEvent(new MessageEvent("message",{
            origin:"https://widget.mediquo.com",
            source:frame.contentWindow,
            data:{command:"message",payload:{professional:{hash:profile[1]}}}
          })),80);
        }
      },
      open_room(id){window.__alternate=id;}
    };
    window.fetch=async()=>Response.json({available:true,items:people});
    const m=await import("/telesaude/diretorio-teste.mjs");
    await m.initDirectory(sdk,"A".repeat(43),"test-patient-sdk-token-for-lab-only");
    return document.getElementById("directory-open").hidden===false;
  },people);
  assert.equal(active,true);
  const layout=await page.evaluate(()=>({
    screen:innerWidth,content:document.documentElement.scrollWidth,
    logo:document.querySelector(".identity").getBoundingClientRect().right,
    directory:document.getElementById("directory-open").getBoundingClientRect().left,
    back:document.querySelector("#back-access").getBoundingClientRect().left
  }));
  assert.ok(layout.content<=layout.screen+2,JSON.stringify(layout));
  assert.ok(layout.logo<=layout.directory+2,"Sobreposição do botão: "+JSON.stringify(layout));
  assert.equal(await page.locator("#appointments-trigger").isVisible(),true);
  await page.locator("#directory-open").click();
  assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),true);
  assert.deepEqual(await page.locator(".directory-section h3").allInnerTexts(),
    ["Clínico geral","Psicologia","Nutrição","Pediatria"]);
  await page.locator("#directory-query").fill("psico");
  assert.equal(await page.locator(".directory-person").count(),1);
  await page.locator(".directory-person").click();
  await page.waitForFunction(()=>document.getElementById("directory-dialog").open===false);
  assert.equal(await page.evaluate(()=>window.__navigation),"/professionals/p02/room");
  await page.close();
 }
 const page=await browser.newPage();
 await page.goto("http://127.0.0.1:8779/telesaude/atendimento-teste/",{waitUntil:"domcontentloaded"});
 await page.evaluate(async()=>{
   window.fetch=async()=>Response.json({available:false,items:[]});
   const module=await import("/telesaude/diretorio-teste.mjs");
   await module.initDirectory({navigate(){}}, "A".repeat(43),"test-patient-sdk-token-for-lab-only");
 });
 await page.locator("#directory-open").click();
 assert.match(await page.locator("#directory-feedback").innerText(),/não retornou profissionais elegíveis/i);
 assert.equal(await page.locator(".directory-person").count(),0);
 await page.close();
}finally{await browser.close();}
console.log("Laboratório opt-in: sem navegação de pacientes, sem mensagens e com layout verificado.");
