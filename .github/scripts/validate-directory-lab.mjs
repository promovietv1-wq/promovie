import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const portal=await readFile("telesaude/index.html","utf8");
const normal=await readFile("telesaude/atendimento/index.html","utf8");
const testPage=await readFile("telesaude/atendimento-teste/index.html","utf8");
const moduleSource=await readFile("telesaude/diretorio-teste.mjs","utf8");
assert.match(portal,/directoryTest=new URLSearchParams\(location.search\).get\("teste"\)==="profissionais"/);
assert.match(portal,/window.location.assign\("\/telesaude\/atendimento\/"\)/);
assert.match(portal,/window.location.assign\("\/telesaude\/atendimento-teste\/"\)/);
assert.doesNotMatch(normal,/directory-open|diretorio-teste|directoryToken/);
assert.match(testPage,/const SDK_SOURCE="https:\/\/widget\.mediquo\.com\/js\/1\.0\.0\/mediquo\.js"/);
assert.match(testPage,/widget\.init\(/);
assert.match(testPage,/widget\.open\(\)/);
assert.match(testPage,/id="directory-open"/);
assert.match(testPage,/id="directory-results"/);
assert.match(testPage,/id="directory-back"/);
assert.match(testPage,/\/telesaude\/diretorio-teste\.mjs/);
assert.match(testPage,/\/telesaude\/" id="back-access"/);
assert.match(moduleSource,/https:\/\/backend\.promovie\.tv\.br\/api\/promovie\/directory\/v1\/catalog/);
assert.doesNotMatch(moduleSource,/sessionStorage|localStorage|document\.cookie/);
const people=[
  {id:"p01",name:"Beatriz Exemplo",title:"General Medicine"},
  {id:"p02",name:"Ana Exemplo",title:"Psychology"},
  {id:"p03",name:"Carlos Exemplo",title:"Nutrition"},
  {id:"p04",name:"Davi Exemplo",title:"Pediatrics"}
];
const browser=await chromium.launch({headless:true});
async function prepare(page,rows,mode="normal"){
 return await page.evaluate(async({rows,mode})=>{
   const frame=document.createElement("iframe");
   frame.id="MediquoContainer";frame.src="about:blank";document.body.append(frame);
   function confirm(id){
     setTimeout(()=>window.dispatchEvent(new MessageEvent("message",{
       origin:"https://widget.mediquo.com",
       source:frame.contentWindow,
       data:{command:"message",payload:{professional:{hash:id}}}
     })),80);
   }
   const sdk={
     ...(mode==="no-navigate"?{}:{navigate(path){
       window.__navigation=path;
       const found=path.match(/\/professionals\/([^/]+)\/room$/);
       if(found)confirm(found[1]);
     }}),
     open_room(id){window.__alternate=id;confirm(id);}
   };
   window.fetch=async()=>Response.json({available:rows.length>0,items:rows});
   const m=await import("/telesaude/diretorio-teste.mjs");
   await m.initDirectory(sdk,"A".repeat(43),"test-patient-sdk-token-for-lab-only");
   return {open:document.getElementById("directory-dialog").open,
     trigger:document.getElementById("directory-open").hidden===false};
 },{rows,mode});
}
try{
 for(const width of [320,360,390,768,1280]){
   const page=await browser.newPage({viewport:{width,height:820}});
   await page.goto("http://127.0.0.1:8779/telesaude/atendimento-teste/",{waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("#directory-open").isHidden(),true);
   const ready=await prepare(page,people);
   assert.equal(ready.open,true);
   assert.equal(ready.trigger,true);
   assert.equal(await page.locator("button.directory-specialty-card").count(),8);
   assert.equal(await page.locator("#directory-title").innerText(),"Como podemos cuidar de você?");
   assert.match(await page.locator(".directory-tone-clinico .directory-specialty-mode").innerText(),/até 10 minutos/);
   const dimensions=await page.evaluate(()=>({
     page:document.documentElement.scrollWidth,
     viewport:document.documentElement.clientWidth,
     dialog:document.getElementById("directory-dialog").scrollWidth,
     panel:document.getElementById("directory-dialog").clientWidth
   }));
   assert.ok(dimensions.page<=dimensions.viewport+2,"overflow página "+width+": "+JSON.stringify(dimensions));
   assert.ok(dimensions.dialog<=dimensions.panel+2,"overflow modal "+width+": "+JSON.stringify(dimensions));
   await page.locator(".directory-tone-psicologia").click();
   assert.equal(await page.locator("#directory-title").innerText(),"Psicologia");
   assert.equal(await page.locator(".directory-person").count(),1);
   assert.equal(await page.locator(".directory-person strong").innerText(),"Ana Exemplo");
   await page.locator(".directory-person").click();
   assert.equal(await page.locator("#directory-title").innerText(),"Conheça o profissional");
   assert.equal(await page.locator(".directory-profile-names h3").innerText(),"Ana Exemplo");
   assert.equal(await page.locator(".directory-profile-mode").innerText(),"Com agendamento");
   await page.locator(".directory-profile-start").click();
   await page.waitForFunction(()=>!document.getElementById("directory-dialog").open);
   assert.equal(await page.evaluate(()=>window.__navigation),"/professionals/p02/room");
   assert.equal(await page.locator("#appointments-trigger").count(),1);
   await page.close();
   console.log("Navegação visual simulada validada:",width+"px");
 }
 const page=await browser.newPage();
 await page.goto("http://127.0.0.1:8779/telesaude/atendimento-teste/",{waitUntil:"domcontentloaded"});
 await prepare(page,[]);
 assert.equal(await page.locator(".directory-specialty-card").count(),8);
 assert.match(await page.locator("#directory-feedback").innerText(),/não retornou profissionais/i);
 await page.locator(".directory-tone-pediatria").click();
 assert.equal(await page.locator(".directory-person").count(),0);
 assert.match(await page.locator(".directory-empty").innerText(),/não há profissionais reais retornados/i);
 await page.locator("#directory-show-widget").click();
 assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
 await page.close();

 const alternative=await browser.newPage();
 await alternative.goto("http://127.0.0.1:8779/telesaude/atendimento-teste/",{waitUntil:"domcontentloaded"});
 await prepare(alternative,people,"no-navigate");
 await alternative.locator(".directory-tone-clinico").click();
 await alternative.locator(".directory-person").click();
 await alternative.locator(".directory-profile-start").click();
 assert.match(await alternative.locator("#directory-feedback").innerText(),/não está disponível/i);
 assert.equal(await alternative.locator("#directory-alternative").isVisible(),true);
 await alternative.locator("#directory-alternative").click();
 await alternative.waitForFunction(()=>!document.getElementById("directory-dialog").open);
 assert.equal(await alternative.evaluate(()=>window.__alternate),"p01");
 await alternative.close();
}finally{await browser.close();}
console.log("Laboratório visual em 3 etapas: testes simulados aprovados, sem enviar mensagens reais.");
