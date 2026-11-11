import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

// Teste de fumaça da entrada oficial. A suíte oficial completa valida
// confirmação única, especialidades, currículos, volta e agendamentos.
const entry=await readFile("telessaude/index.html","utf8");
const attendance=await readFile("telessaude/atendimento/index.html","utf8");
const directory=await readFile("telessaude/diretorio.mjs","utf8");
const information=await readFile("telessaude/informacoes/index.html","utf8");
const manifest=JSON.parse(await readFile("telessaude/manifest.webmanifest","utf8"));
const pwa=await readFile("telessaude/pwa-install.js","utf8");
const sw=await readFile("telessaude/sw.js","utf8");
assert.match(entry,/const pulseProfilesTest=true;/);
assert.match(entry,/const originalChatTest=false;/);
assert.match(entry,/window\.location\.assign\("\/telessaude\/atendimento\/"\)/);
assert.match(entry,/canonical" href="https:\/\/www\.promovie\.tv\.br\/telessaude\//);
assert.match(attendance,/\/telessaude\/diretorio\.mjs/);
assert.match(attendance,/const PREVIEW_ALWAYS_SHOW=false/);
assert.match(information,/const PREVIEW_ALWAYS_SHOW=false/);
assert.match(information,/Eu li as informações acima/);
assert.match(directory,/\/telesaude\/curriculos\//);
assert.match(attendance,/environment:"production"/);
assert.match(attendance,/accessToken:handoff\.accessToken/);
assert.match(attendance,/Agendamentos e Suporte/);
assert.match(attendance,/promovie-contato-whatsapp/);
assert.equal(manifest.start_url,"/telessaude/");
assert.equal(manifest.scope,"/telessaude/");
assert.equal(manifest.display,"browser");
assert.match(pwa,/serviceWorker\.register\("\/telessaude\/sw\.js"/);
assert.match(sw,/event\.respondWith\(fetch\(request\)\)/);
assert.doesNotMatch(sw,/caches\.open/);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [375,768,1280]){
  const context=await browser.newContext({viewport:{width,height:850}});
  await context.route("https://backend.promovie.tv.br/api/promovie/access/v1/health",r=>
    r.fulfill({status:200,contentType:"application/json",body:'{"disponivel":true}'}));
  await context.route("https://backend.promovie.tv.br/api/promovie/access/v1/session",async r=>{
    assert.equal(r.request().postDataJSON().directoryTest,true);
    await r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
      apiKey:"CI-TEST-NO-PATIENT",access_token:"FAKE-SDK-ACCESS-TOKEN",environment:"production",
      directory_token:"X".repeat(43)})});
  });
  await context.route("https://backend.promovie.tv.br/api/promovie/space/v1/session",r=>
    r.fulfill({status:503,contentType:"application/json",body:"{}"}));
  await context.route("https://backend.promovie.tv.br/api/promovie/directory/v1/catalog-profile",r=>
    r.fulfill({status:200,contentType:"application/json",body:'{"items":[]}'}));
  await context.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",r=>
    r.fulfill({status:200,contentType:"application/javascript",
      body:"window.MediquoWidget={init:async()=>{},open:async()=>{window.__sdkOpened=true}};"}));
  const page=await context.newPage();
  await page.goto("http://127.0.0.1:8779/telessaude/",{waitUntil:"domcontentloaded"});
  await page.locator("#access-cpf").fill("12345678909");
  await page.locator("#access-code").fill("CI-NO-REAL");
  await page.locator("#install-now:not([disabled])").waitFor({timeout:15000});
  await page.locator("#install-now").click();
  await page.waitForURL(/\/telessaude\/atendimento\//,{timeout:15000});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("promovie:mediquo:handoff:v1")),null);
  await page.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
  assert.equal(await page.locator("#pv-brand-intro-back").getAttribute("aria-disabled"),"true");
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkOpened)),false);
  console.log("Página oficial, leitura inicial e SDK preservados:",width);
  await context.close();
 }
}finally{await browser.close();}
