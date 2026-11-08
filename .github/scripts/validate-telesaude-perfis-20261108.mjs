import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const next=await readFile("telesaude/atendimento-perfis-20261108/index.html","utf8");
const original=await readFile("telesaude/atendimento-20261107/index.html","utf8");
const current=await readFile("telesaude/atendimento-especialidades-20261107/index.html","utf8");
const normal=await readFile("telesaude/atendimento/index.html","utf8");
const portal=await readFile("telesaude/index.html","utf8");
const profiles=await readFile("telesaude/diretorio-perfis-20261108.mjs","utf8");
assert.match(next,/diretorio-perfis-20261108.mjs/);
assert.match(profiles,/\/catalog-profile/);
assert.match(portal,/teste"\)==="20261108-perfis"/);
assert.match(portal,/atendimento-perfis-20261108/);
assert.doesNotMatch(original,/diretorio-perfis-20261108/);
assert.doesNotMatch(current,/diretorio-perfis-20261108/);
assert.doesNotMatch(normal,/diretorio-perfis-20261108/);
assert.match(profiles,/\/professionals\/"\+encodeURIComponent\(chosenPerson.id\)\+"\/room"/);

const fakeProfiles=[
 {id:"p-psicologia-01",name:"Alicia Rodrigues",title:"Psicologia",
  description:"Psicóloga clínica com atuação em terapia do esquema, autoestima, autoconhecimento e ansiedade.",
  avatar:"https://api.mediquo.com/profile/test.svg",
  collegiate_number:"CRP-04/77069",status:"online",languages:["Português"]},
 {id:"p-nutricao-02",name:"Ana Paula Santi",title:"Nutrição",
  description:"Atendimento em nutrição para saúde da mulher.",
  avatar:"",status:"offline"},
 {id:"p-psicologia-03",name:"Ana Clara Vieira",title:"Psicologia",description:"",avatar:""}
];
const browser=await chromium.launch({headless:true});
async function setup(width){
 const page=await browser.newPage({viewport:{width,height:850}});
 await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",r=>r.fulfill({
   status:200,contentType:"application/javascript",
   body:"window.MediquoWidget={init:async()=>{window.__sdkInit=(window.__sdkInit||0)+1},open:async()=>{window.__sdkOpen=(window.__sdkOpen||0)+1},navigate:path=>{window.__sdkRoute=path}};"
 }));
 await page.route("https://api.mediquo.com/profile/test.svg",r=>r.fulfill({
   status:200,contentType:"image/svg+xml",
   body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ccc"/></svg>'
 }));
 await page.addInitScript(items=>{
   sessionStorage.setItem("promovie:mediquo:handoff:v1",JSON.stringify({
     apiKey:"TEST-WIDGET-API-KEY",accessToken:"TEST-ACCESS-TOKEN-FAKE-ONLY-123456789",
     environment:"production",createdAt:Date.now(),
     directoryToken:"G".repeat(43)
   }));
   const old=window.fetch.bind(window);
   window.fetch=(resource,options)=>{
     if(String(resource).endsWith("/api/promovie/directory/v1/catalog-profile"))
       return Promise.resolve(new Response(JSON.stringify({available:true,items}),{
         status:200,headers:{"content-type":"application/json"}
       }));
     return old(resource,options);
   };
 },fakeProfiles);
 await page.goto("http://127.0.0.1:8779/telesaude/atendimento-perfis-20261108/",{waitUntil:"domcontentloaded"});
 await page.locator("#directory-dialog[open]").waitFor();
 await page.locator("#hub-category-grid .hub-category").first().waitFor();
 await page.waitForFunction(()=>window.__sdkInit===1);
 assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0,"A lista médica não deve abrir antes da escolha");
 return page;
}
try{
 for(const width of [375,1280]){
   const page=await setup(width);
   const cards=page.locator("#hub-category-grid .hub-category");
   assert.equal(await cards.count(),8);
   await cards.nth(1).click();
   assert.equal(await page.locator("#hub-professionals .hub-person").count(),2);
   const alice=page.locator("#hub-professionals .hub-person").filter({hasText:"Alicia Rodrigues"}).first();
   await alice.locator(".hub-avatar.photo-ready img").waitFor();
   assert.equal(await alice.locator(".hub-avatar img").getAttribute("alt"),"Foto de Alicia Rodrigues");
   assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0);
   await alice.click();
   await page.locator("#hub-profile").waitFor();
   assert.match(await page.locator("#hub-profile .hub-profile-description").innerText(),/terapia do esquema/);
   assert.match(await page.locator("#hub-profile .pv-profile-data").innerText(),/CRP-04\/77069/);
   await page.locator("#hub-profile .hub-avatar.photo-ready img").waitFor();
   assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0);
   const button=page.locator("#hub-open");
   assert.match(await button.innerText(),/Acessar atendimento com Alicia Rodrigues/);
   await button.click();
   await page.waitForFunction(()=>window.__sdkRoute==="/professionals/p-psicologia-01/room");
   assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
   await page.close();
   console.log("Foto oficial, descrição e registro antes de chamar conversa:",width);
 }
 const page=await setup(390);
 await page.locator("#hub-native").click();
 await page.waitForFunction(()=>window.__sdkOpen===1);
 await page.locator("#chat-search-name").fill("Alicia");
 const search=page.locator("#chat-search-results");
 await search.locator(".chat-search-person").first().waitFor();
 await search.locator(".chat-search-person").first().click();
 await search.locator(".chat-inline-profile .hub-avatar.photo-ready img").waitFor();
 assert.match(await search.locator(".chat-inline-summary").innerText(),/terapia do esquema/);
 assert.match(await search.locator(".pv-profile-data").innerText(),/CRP-04\/77069/);
 assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
 assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
 await search.locator("[data-action=open]").click();
 await page.waitForFunction(()=>window.__sdkRoute==="/professionals/p-psicologia-01/room");
 assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
 await page.locator("#directory-open").click();
 await page.locator("#directory-dialog[open]").waitFor();
 await page.locator("#hub-global-query").fill("Ana Clara");
 await page.locator("#hub-global-results .hub-person").first().click();
 assert.match(await page.locator("#hub-profile .hub-profile-description").innerText(),
 /Não conseguimos carregar a descrição/);
 assert.equal(await page.locator("#hub-profile .hub-avatar img").count(),0);
 await page.close();
 console.log("Busca inline, perfil sem biografia e inicial como fallback: OK.");
}finally{
 await browser.close();
}
console.log("Novo laboratório aprovado com dados fictícios. Nenhum paciente real foi consultado.");
