import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const source=await readFile("telessaude/index.html","utf8");
const entry=await readFile("telessaude/teste-aceite/index.html","utf8");
const current=await readFile("telessaude/atendimento/index.html","utf8");
const test=await readFile("telessaude/teste-aceite/atendimento/index.html","utf8");
const directory=await readFile("telessaude/teste-aceite/diretorio.mjs","utf8");
const information=await readFile("telessaude/teste-aceite/informacoes/index.html","utf8");
assert.match(entry,/window\.location\.assign\("\/telessaude\/teste-aceite\/atendimento\/"\)/);
assert.match(entry,/Teste do consentimento real/);
assert.match(test,/id="pv-brand-intro"/);
assert.match(test,/Sua saúde merece uma experiência completa/);
assert.match(test,/Conte com a PromoVie na sua jornada de saúde/);
assert.match(test,/id="pv-brand-info-link"/);
assert.match(test,/href="\/telessaude\/teste-aceite\/informacoes\/" target="_blank" rel="noopener noreferrer"/);
assert.match(entry,/class="pv-test-info-link"/);
assert.match(information,/<html lang="pt-BR">/);
assert.match(information,/<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(information,/id="pv-doc-terms"/);
assert.match(information,/id="pv-doc-privacy"/);
assert.match(information,/target="_blank" rel="noopener noreferrer"/);
assert.match(information,/tradução automática é um auxílio à leitura/);
assert.match(information,/id="copy-summary"/);
assert.doesNotMatch(information,/MediquoWidget|accessToken:|apiKey:|\/api\/promovie\//);
assert.match(test,/locale:"pt"/);
assert.match(test,/environment:"production"/);
assert.match(test,/widget\.init\(\{/);
assert.match(test,/accessToken:handoff\.accessToken/);
assert.match(test,/ensurePromoVieIntro/);
assert.match(test,/await ensurePromoVieIntro\(\)/);
assert.match(test,/PV_BRAND_INTRO_CANCELLED/);
assert.match(directory,/PV_BRAND_INTRO_CANCELLED/);
assert.match(current,/diretorio-perfis-20261109-batimentos\.mjs/);
assert.match(source,/window\.location\.assign\("\/telessaude\/atendimento\/"\)/);
assert.doesNotMatch(test,/terms_link\s*:/);
assert.doesNotMatch(test,/privacy_link\s*:/);
assert.doesNotMatch(test,/MediquoWidget\.logout\(/);
assert.doesNotMatch(test,/MediquoWidget\.destroy\(/);

const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:850}});
  const pageErrors=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/health",route=>
    route.fulfill({status:200,contentType:"application/json",body:'{"disponivel":true}'}));
  await page.route("https://backend.promovie.tv.br/api/promovie/access/v1/session",route=>{
    const body=route.request().postDataJSON();
    assert.equal(body.directoryTest,true);
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
     apiKey:"NONREAL-TEST-PUBLIC-ONLY",access_token:"NONREAL-FAKE-TOKEN-01234567890123456789",
     directory_token:"X".repeat(43),environment:"production"})});
  });
  await page.route("https://backend.promovie.tv.br/api/promovie/space/v1/session",route=>
    route.fulfill({status:503,contentType:"application/json",body:"{}"}));
  await page.route("https://backend.promovie.tv.br/api/promovie/directory/v1/catalog-profile",route=>
    route.fulfill({status:200,contentType:"application/json",body:'{"items":[]}'}));
  await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>
    route.fulfill({status:200,contentType:"application/javascript",
     body:"window.MediquoWidget={init:async(cfg)=>{window.__sdkConfig={locale:cfg.theme?.locale,environment:cfg.environment,hasTerms:!!cfg.terms_link,hasPrivacy:!!cfg.privacy_link}},open:async()=>{window.__sdkOpened=(window.__sdkOpened||0)+1}};"}));
  await page.goto("http://127.0.0.1:8779/telessaude/teste-aceite/",{waitUntil:"domcontentloaded"});
  await page.locator("#access-cpf").fill("12345678909");
  await page.locator("#access-code").fill("CI-ONLY");
  await page.locator("#install-now:not([disabled])").waitFor({timeout:15000});
  await page.locator("#install-now").click();
  await page.waitForURL(/\/telessaude\/teste-aceite\/atendimento\//,{timeout:15000});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem("promovie:mediquo:handoff:v1")),null);
  await page.locator("#hub-native").waitFor();
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkOpened)),false);
  assert.equal(await page.locator("#pv-brand-intro").evaluate(d=>d.open),false);
  await page.locator("#hub-native").click();
  await page.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
  const popupPromise=page.waitForEvent("popup");
  await page.locator("#pv-brand-info-link").click();
  const popup=await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.equal(new URL(popup.url()).pathname,"/telessaude/teste-aceite/informacoes/");
  assert.equal(await popup.locator("html").getAttribute("lang"),"pt-BR");
  assert.match(await popup.locator("h1").textContent(),/experiência de cuidado/);
  const originalTerms=popup.locator("#pv-doc-terms");
  const originalPrivacy=popup.locator("#pv-doc-privacy");
  assert.equal(await originalTerms.getAttribute("href"),
    "https://mediquo-api.s3.eu-central-1.amazonaws.com/filesystem/uploads/terms/TerminosyCondicionesmediQuoversionfinal_37947.html");
  assert.equal(await originalPrivacy.getAttribute("href"),
    "https://widget.mediquo.com/privacy/index.html");
  assert.equal(await originalTerms.getAttribute("target"),"_blank");
  assert.equal(await originalPrivacy.getAttribute("target"),"_blank");
  await popup.locator("#copy-summary").click();
  await popup.locator("#copy-status:not(:empty)").waitFor();
  assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),true,
    "A página de informações não deve ter rolagem horizontal");
  assert.equal(await page.locator("#pv-brand-intro").evaluate(d=>d.open),true,
    "Ler informações em outra aba não deve dispensar apresentação nem consentimento");
  await popup.close();
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkConfig)),false);
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkOpened)),false);
  await page.locator("#pv-brand-intro-back").click();
  await page.locator("#directory-dialog[open]").waitFor();
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkOpened)),false);
  await page.locator("#hub-native").click();
  await page.locator("#pv-brand-intro-next").click();
  await page.waitForFunction(()=>window.__sdkOpened===1,{timeout:15000});
  const cfg=await page.evaluate(()=>window.__sdkConfig);
  assert.deepEqual(cfg,{locale:"pt",environment:"production",hasTerms:false,hasPrivacy:false});
  assert.deepEqual(pageErrors,[]);
  console.log("Fluxo real simulado sem paciente: pré-tela PromoVie + SDK PT + sem autoaceite:",width);
  await page.close();
 }
}finally{await browser.close();}
