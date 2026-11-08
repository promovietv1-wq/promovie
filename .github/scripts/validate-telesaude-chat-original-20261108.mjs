import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const base=await readFile("telesaude/atendimento-chat-original-20261108/index.html","utf8");
const module=await readFile("telesaude/diretorio-chat-original-20261108.mjs","utf8");
const original=await readFile("telesaude/atendimento-20261107/index.html","utf8");
const specialties=await readFile("telesaude/atendimento-especialidades-20261107/index.html","utf8");
const richProfiles=await readFile("telesaude/atendimento-perfis-20261108/index.html","utf8");
const prod=await readFile("telesaude/atendimento/index.html","utf8");
const portal=await readFile("telesaude/index.html","utf8");
assert.match(base,/diretorio-chat-original-20261108\.mjs/);
assert.match(portal,/teste"\)==="20261108-chat-original"/);
assert.match(portal,/atendimento-chat-original-20261108/);
assert.match(module,/api\/promovie\/directory\/v1\/catalog"/);
assert.doesNotMatch(module,/directory\/v1\/catalog-profile/);
assert.doesNotMatch(original,/diretorio-chat-original/);
assert.doesNotMatch(specialties,/diretorio-chat-original/);
assert.doesNotMatch(richProfiles,/diretorio-chat-original/);
assert.doesNotMatch(prod,/diretorio-chat-original/);
assert.match(module,/\/professionals\/"\+encodeURIComponent\(p.id\)\+"\/room"/);
assert.match(module,/Ao abrir o profissional no Chat Médico/);
assert.doesNotMatch(module,/"Ver perfil ›"/);
assert.match(module,/Abrir no Chat Médico ›/);

const items=[
 {id:"psych-one",name:"Alicia Rodrigues",title:"Psicologia"},
 {id:"psych-two",name:"Ana Clara Vieira",title:"Psicologia"},
 {id:"food-one",name:"Ana Paula",title:"Nutrição"},
 {id:"pet-one",name:"Dr. Pet",title:"Veterinária"}
];
const browser=await chromium.launch({headless:true});
async function setup(width){
 const page=await browser.newPage({viewport:{width,height:820}});
 await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>route.fulfill({
   status:200,contentType:"application/javascript",
   body:"window.MediquoWidget={init:async()=>{window.__sdkInit=(window.__sdkInit||0)+1},open:async()=>{window.__sdkOpens=(window.__sdkOpens||0)+1},navigate:async path=>{window.__sdkNavigation=path;window.__sdkRoutes=(window.__sdkRoutes||[]).concat(path)},open_room:async id=>{window.__sdkOpenRoom=id}};"
 }));
 await page.addInitScript(authorized=>{
   sessionStorage.setItem("promovie:mediquo:handoff:v1",JSON.stringify({
     apiKey:"TEST-NOT-REAL",accessToken:"TEST-TOKEN-NOT-REAL-123456789000",
     environment:"production",createdAt:Date.now(),directoryToken:"D".repeat(43)
   }));
   const prev=window.fetch.bind(window);
   window.fetch=(url,opts)=>{
     if(String(url).endsWith("/api/promovie/directory/v1/catalog"))
       return Promise.resolve(new Response(JSON.stringify({available:true,items:authorized}),{
         status:200,headers:{"Content-Type":"application/json"}
       }));
     return prev(url,opts);
   };
 },items);
 await page.goto("http://127.0.0.1:8779/telesaude/atendimento-chat-original-20261108/",{waitUntil:"domcontentloaded"});
 await page.locator("#directory-dialog[open]").waitFor();
 await page.waitForFunction(()=>window.__sdkInit===1);
 await page.locator("#hub-category-grid .hub-category").first().waitFor();
 assert.equal(await page.evaluate(()=>window.__sdkOpens||0),0);
 assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),true);
 assert.equal(await page.locator("#hub-profile").isVisible(),false);
 return page;
}
try{
 for(const width of [375,1280]){
   const page=await setup(width);
   const cards=page.locator("#hub-category-grid .hub-category");
   assert.equal(await cards.count(),8);
   await cards.nth(1).click();
   assert.equal(await page.locator("#hub-professionals .hub-person").count(),2);
   assert.match(await page.locator(".hub-original-profile-help").innerText(),
     /nome ou na foto/);
   assert.equal(await page.locator("#hub-professionals .hub-person-arrow").first().innerText(),
     "Abrir no Chat Médico ›");
   assert.equal(await page.evaluate(()=>window.__sdkOpens||0),0);
   await page.locator("#hub-professionals .hub-person").filter({hasText:"Alicia Rodrigues"}).click();
   await page.waitForFunction(()=>window.__sdkNavigation==="/professionals/psych-one/room");
   assert.equal(await page.evaluate(()=>window.__sdkOpens),1);
   assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
   assert.equal(await page.locator("#hub-profile").isVisible(),false);
   await page.close();
   console.log("Diretório -> sala original, sem prévia fake, viewport:",width);
 }
 const page=await setup(390);
 await page.locator("#hub-global-query").fill("Ana Paula");
 await page.locator("#hub-global-results .hub-person").first().waitFor();
 assert.equal(await page.evaluate(()=>window.__sdkOpens||0),0);
 await page.locator("#hub-global-results .hub-person").first().click();
 await page.waitForFunction(()=>window.__sdkNavigation==="/professionals/food-one/room");
 assert.equal(await page.evaluate(()=>window.__sdkOpens),1);
 assert.equal(await page.locator("#hub-profile").isVisible(),false);
 await page.locator("#directory-open").click();
 await page.locator("#directory-dialog[open]").waitFor();
 await page.locator("#hub-native").click();
 assert.equal(await page.evaluate(()=>window.__sdkOpens),1);
 await page.locator("#chat-search-name").fill("Dr. Pet");
 await page.locator("#chat-search-results .chat-search-person").first().waitFor();
 assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
 await page.locator("#chat-search-results .chat-search-person").first().click();
 await page.waitForFunction(()=>window.__sdkNavigation==="/professionals/pet-one/room");
 assert.equal(await page.evaluate(()=>window.__sdkOpens),1);
 assert.equal(await page.locator("#chat-search-results").isVisible(),false);
 assert.equal(await page.locator("#hub-profile").isVisible(),false);
 await page.close();
 console.log("Busca geral e busca dentro do Chat Médico abriram a sala original, sem telas intermediárias.");
}finally{await browser.close();}
console.log("Abertura do perfil interno da Médiquo depende da UI real do fornecedor e não foi simulada.");
