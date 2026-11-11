import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

// Validação isolada: somente UI experimental e serviços simulados.
// Nenhuma conta de paciente, SDK de produção ou sessão clínica real é utilizada.
const entry=await readFile("telessaude/teste-aceite/index.html","utf8");
const attendance=await readFile("telessaude/teste-aceite/atendimento/index.html","utf8");
const information=await readFile("telessaude/teste-aceite/informacoes/index.html","utf8");
const directory=await readFile("telessaude/teste-aceite/diretorio.mjs","utf8");
const lettering=await readFile("telessaude/teste-aceite/assets/telessaude-lettering.svg","utf8");
const encodedPng=lettering.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/)?.[1];
assert.ok(encodedPng&&encodedPng.length>2000,"Preservar arte original");
assert.ok(entry.includes('src="/telessaude/teste-aceite/assets/telessaude-lettering.png"'),"Usar a arte PNG real no acesso");
assert.ok(attendance.includes('Informações necessárias para o seu atendimento'));
assert.ok(information.includes('Eu li as informações acima sobre atendimento, privacidade e consentimento.'));
assert.ok(attendance.includes('Por gentileza, leia as informações necessárias para o seu atendimento.'));
assert.ok(attendance.includes('if(hasRead())'));
assert.ok(information.includes('readingReference'));
assert.ok(directory.includes("initSpecialtyDirectory"));
assert.ok(attendance.includes('environment:"production"'),"Não modificar ambiente clínico");
assert.ok(attendance.includes('accessToken:handoff.accessToken'),"Preservar SDK");
assert.ok(!information.includes("MediquoWidget"),"Ciência local fora do SDK");

const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8779";
async function stubServices(context){
 await context.route("https://backend.promovie.tv.br/api/promovie/access/v1/health",route=>
   route.fulfill({status:200,contentType:"application/json",body:'{"disponivel":true}'}));
 await context.route("https://backend.promovie.tv.br/api/promovie/access/v1/session",route=>
   route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     apiKey:"TEST-SDK-NON-REAL",access_token:"FAKE-ACCESS-TOKEN-01234567890123456789",
     directory_token:"X".repeat(43),environment:"production"
   })}));
 await context.route("https://backend.promovie.tv.br/api/promovie/space/v1/session",route=>
   route.fulfill({status:503,contentType:"application/json",body:"{}"}));
 await context.route("https://backend.promovie.tv.br/api/promovie/directory/v1/catalog-profile",route=>
   route.fulfill({status:200,contentType:"application/json",body:'{"items":[]}'}));
 await context.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>
   route.fulfill({status:200,contentType:"application/javascript",
     body:'window.MediquoWidget={init:async cfg=>{window.__sdkConfig=cfg},open:async()=>{window.__sdkOpened=(window.__sdkOpened||0)+1}};'}));
}
async function login(page,cpf){
 await page.goto(base+"/telessaude/teste-aceite/",{waitUntil:"domcontentloaded"});
 await page.locator("#access-cpf").fill(cpf);
 await page.locator("#access-code").fill("CI-ONLY");
 await page.locator("#install-now:not([disabled])").waitFor({timeout:15000});
 const image=await page.locator(".pv-access-lettering").evaluate(img=>({
   complete:img.complete,width:img.naturalWidth,height:img.naturalHeight
 }));
 assert.deepEqual(image,{complete:true,width:178,height:29},"Lettering não exibido corretamente no acesso");
 await page.locator("#install-now").click();
 await page.waitForURL(/\/telessaude\/teste-aceite\/atendimento\//,{timeout:15000});
 assert.equal(await page.evaluate(()=>sessionStorage.getItem("promovie:mediquo:handoff:v1")),null);
 await page.locator("#directory-open:not([hidden])").waitFor({timeout:10000});
}

try{
 for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:850}});
   await stubServices(context);
   const errors=[];
   const first=await context.newPage();
   first.on("pageerror",error=>errors.push(error.message));
   await login(first,"12345678909");
   await first.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
   assert.equal(await first.locator("#pv-brand-intro-back").getAttribute("aria-disabled"),"true");
   assert.equal(await first.locator("#directory-open").getAttribute("aria-disabled"),"true");
   assert.equal(await first.evaluate(()=>Boolean(window.__sdkOpened)),false);
   await first.locator("#pv-brand-intro-back").click({force:true});
   assert.match(await first.locator("#pv-read-blocked").textContent(),/Por gentileza, leia/);
   assert.equal(await first.locator("#pv-brand-intro").evaluate(d=>d.open),true);

   const popupPromise=first.waitForEvent("popup");
   await first.locator("#pv-brand-info-link").click();
   const info=await popupPromise;
   await info.waitForLoadState("domcontentloaded");
   assert.match(new URL(info.url()).searchParams.get("leitura")||"",/^pv2_[A-Za-z0-9_-]{43}$/);
   assert.equal(await info.locator("#close-info").getAttribute("aria-disabled"),"true");
   await info.locator("#close-info").click({force:true});
   assert.match(await info.locator("#pv-awareness-feedback").textContent(),/confirme a leitura/i);
   await info.locator("#pv-awareness-check").check();
   assert.equal(await info.locator("#close-info").getAttribute("aria-disabled"),"false");
   await first.waitForFunction(()=>
     document.querySelector("#pv-brand-intro-back")?.getAttribute("aria-disabled")==="false");
   await info.locator("#close-info").click();
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator("#pv-brand-intro").evaluate(d=>d.open),false);
   assert.equal(await first.evaluate(()=>Boolean(window.__sdkOpened)),false);

   // Somente um clique explícito no chat abre o SDK original de atendimento.
   await first.locator("#hub-native").click();
   await first.waitForFunction(()=>window.__sdkOpened===1,{timeout:15000});
   assert.equal(await first.evaluate(()=>window.__sdkConfig.environment),"production");
   await first.close();

   // Modo de revisão: mesmo beneficiário também vê apresentação novamente.
   const repeat=await context.newPage();
   repeat.on("pageerror",error=>errors.push(error.message));
   await login(repeat,"12345678909");
   await repeat.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
   assert.equal(await repeat.locator("#pv-brand-intro").evaluate(d=>d.open),true);
   await repeat.close();

   // Segundo CPF no mesmo navegador não herda indevidamente a ciência do primeiro.
   const another=await context.newPage();
   another.on("pageerror",error=>errors.push(error.message));
   await login(another,"98765432100");
   await another.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
   assert.equal(await another.locator("#pv-brand-intro-back").getAttribute("aria-disabled"),"true");
   await another.close();

   assert.deepEqual(errors,[],"Erros de execução no fluxo experimental");
   await context.close();
   console.log("Fluxo de leitura, bloqueio e retorno aprovado:",width);
 }
}finally{await browser.close();}
