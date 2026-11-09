import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const entry=await readFile("telessaude/index.html","utf8");
const attendance=await readFile("telessaude/atendimento/index.html","utf8");
const directory=await readFile("telesaude/diretorio-perfis-20261109-batimentos.mjs","utf8");
const legacy=await readFile("telesaude/index.html","utf8");
const workspace=await readFile("telesaude/meu-espaco/space.js","utf8");
const manifest=JSON.parse(await readFile("telessaude/manifest.webmanifest","utf8"));
const pwa=await readFile("telessaude/pwa-install.js","utf8");
const sw=await readFile("telessaude/sw.js","utf8");

assert.match(entry,/const pulseProfilesTest=true;/);
assert.match(entry,/const originalChatTest=false;/);
assert.match(entry,/window\.location\.assign\("\/telessaude\/atendimento\/"\)/);
assert.doesNotMatch(entry,/id="directory-test-login"/);
assert.match(entry,/canonical" href="https:\/\/www\.promovie\.tv\.br\/telessaude\//);
assert.match(attendance,/diretorio-perfis-20261109-batimentos\.mjs/);
assert.match(attendance,/location\.pathname==="\/telessaude\/atendimento\//);
assert.match(attendance,/Agendamentos e Suporte/);
assert.match(attendance,/promovie-contato-whatsapp/);
assert.match(directory,/profissionais-telessaude\.vercel\.app/);
assert.match(directory,/M2\.5 12h3\.7/);
assert.match(workspace,/\/telessaude\/atendimento\//);
assert.match(legacy,/const pulseProfilesTest=new URLSearchParams/);
assert.equal(manifest.start_url,"/telessaude/");
assert.equal(manifest.scope,"/telessaude/");
assert.equal(manifest.display,"browser");
assert.match(pwa,/serviceWorker\.register\("\/telessaude\/sw\.js"/);
assert.match(sw,/event\.respondWith\(fetch\(request\)\)/);
assert.doesNotMatch(sw,/caches\.open/);
assert.doesNotMatch(entry,/>TESTE</);

const browser=await chromium.launch({headless:true});
try{
  for(const width of [375,768,1280]){
    const page=await browser.newPage({viewport:{width,height:850}});
    page.on("pageerror",err=>{throw err;});
    await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/health",route=>
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({disponivel:true})}));
    await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/session",async route=>{
      const data=route.request().postDataJSON();
      assert.equal(data.directoryTest,true);
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        apiKey:"CI-NO-REAL-PATIENT",access_token:"CI-MOCK-TOKEN",environment:"production",
        directory_token:"X".repeat(43)})});
    });
    await page.route("https://backend.promovie.tv.br/api/promovie/space/v1/session",route=>
      route.fulfill({status:503,contentType:"application/json",body:"{}"}));
    await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>
      route.fulfill({status:200,contentType:"application/javascript",
        body:"window.MediquoWidget={init:async()=>{},open:async()=>{window.__widgetOpened=true}};"}));
    await page.goto("http://127.0.0.1:8779/telessaude/?teste=20261108-chat-original&utm_source=chatgpt.com",
      {waitUntil:"domcontentloaded"});
    assert.match(await page.title(),/Telessaúde/);
    assert.equal(await page.locator("#directory-test-login").count(),0);
    await page.locator("#access-cpf").fill("12345678909");
    await page.locator("#access-code").fill("CI-NONREAL");
    await page.locator("#install-now:not([disabled])").waitFor();
    await page.locator("#install-now").click();
    await page.waitForURL(/\/telessaude\/atendimento\//,{timeout:15000});
    assert.equal(new URL(page.url()).pathname,"/telessaude/atendimento/");
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("promovie:mediquo:handoff:v1")),null,
      "O handoff deve ser consumido ao abrir a área de atendimento");
    await page.locator("#hub-professionals-link").waitFor({timeout:12000});
    assert.equal(await page.locator("#hub-professionals-link").getAttribute("href"),
      "https://profissionais-telessaude.vercel.app/");
    assert.equal(await page.locator("#appointments-trigger").textContent(),"Agendamentos e Suporte");
    assert.equal(await page.locator("#back-access").getAttribute("href"),"/telessaude/");
    const style=await page.locator(".stage").evaluate(el=>getComputedStyle(el).backgroundImage);
    assert.match(style,/linear-gradient/);
    assert.equal(await page.evaluate(()=>Boolean(window.__widgetOpened)),false,
      "Chat Médico não pode abrir automaticamente");
    console.log("Rota principal, Especialidades e botão de currículos verificados:",width);
    await page.close();
  }
}finally{await browser.close();}
