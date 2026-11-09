import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const entry=await readFile("telesaude/entrar-especialidades/index.html","utf8");
const original=await readFile("telesaude/index.html","utf8");
const target=await readFile("telesaude/atendimento-perfis-20261109-batimentos/index.html","utf8");
assert.match(entry,/const pulseProfilesTest=true;/);
assert.match(entry,/const originalChatTest=false;/);
assert.match(entry,/const curriculumProfilesTest=false;/);
assert.match(entry,/atendimento-perfis-20261109-batimentos/);
assert.match(original,/const pulseProfilesTest=new URLSearchParams/);
assert.doesNotMatch(original,/const pulseProfilesTest=true;/);
assert.match(target,/diretorio-perfis-20261109-batimentos\.mjs/);

const browser=await chromium.launch({headless:true});
try {
  for (const width of [390,1280]) {
    const page=await browser.newPage({viewport:{width,height:850}});
    await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/health",route=>
      route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({disponivel:true})}));
    await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/session",async route=>{
      const body=route.request().postDataJSON();
      assert.equal(body.directoryTest,true,"A escolha deve abrir perfis, não a lista médica direta");
      return route.fulfill({status:200,contentType:"application/json",
        body:JSON.stringify({apiKey:"CI-FAKE-ONLY",access_token:"CI-ACCESS-TOKEN-FAKE-123456789",environment:"production",
          directory_token:"X".repeat(43)})});
    });
    await page.route("https://backend.promovie.tv.br/api/promovie/space/v1/session",route=>
      route.fulfill({status:503,contentType:"application/json",body:"{}"}));
    await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>
      route.fulfill({status:200,contentType:"application/javascript",
        body:"window.MediquoWidget={init:async()=>{},open:async()=>{}};"}));
    await page.goto("http://127.0.0.1:8779/telesaude/entrar-especialidades/?teste=20261108-chat-original&utm_source=chatgpt.com",
      {waitUntil:"domcontentloaded"});
    assert.match(await page.title(),/Especialidades|Telessaúde/);
    await page.locator("#access-cpf").fill("12345678909");
    await page.locator("#access-code").fill("TEST-CODE");
    await page.locator("#install-now:not([disabled])").waitFor();
    await page.locator("#install-now").click();
    await page.waitForURL(/\/telesaude\/atendimento-perfis-20261109-batimentos\//,{timeout:15000});
    assert.equal(new URL(page.url()).pathname,"/telesaude/atendimento-perfis-20261109-batimentos/");
    console.log("Entrada independente redirecionou para perfis, sem cair no Chat original:",width);
    await page.close();
  }
} finally {await browser.close();}
