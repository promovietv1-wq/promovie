import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";

const source=await readFile("telessaude/index.html","utf8");
const entry=await readFile("telessaude/teste-aceite/index.html","utf8");
const current=await readFile("telessaude/atendimento/index.html","utf8");
const test=await readFile("telessaude/teste-aceite/atendimento/index.html","utf8");
const directory=await readFile("telessaude/teste-aceite/diretorio.mjs","utf8");
const information=await readFile("telessaude/teste-aceite/informacoes/index.html","utf8");
const lettering=await readFile("telessaude/teste-aceite/assets/telessaude-lettering.svg","utf8");
const pngBase64=lettering.match(/href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/)?.[1];
assert.ok(pngBase64,"Wordmark must retain embedded raster from user supplied example");
assert.equal(pngBase64.length,2892,"Tinted raster must remain intact");
assert.equal(Buffer.from(pngBase64,"base64").subarray(0,8).toString("hex"),"89504e470d0a1a0a");
assert.match(entry,/window\.location\.assign\("\/telessaude\/teste-aceite\/atendimento\/"\)/);
assert.match(entry,/Teste do consentimento real/);
assert.match(test,/id="pv-brand-intro"/);
assert.match(test,/Sua saúde merece uma experiência excelente/);
assert.match(test,/class="pv-lockup-name">PromoVie<\/span>/);
assert.match(test,/class="pv-topbar-lockup"/);
assert.match(test,/class="pv-lockup"/);
assert.match(test,/A Telessaúde PromoVie reúne acesso/);
assert.doesNotMatch(test,/class="pv-lettering-inline"/);
assert.doesNotMatch(information,/class="pv-lettering-inline" src=/);
assert.match(test,/PromoVie reúne acesso a profissionais de saúde, orientação e suporte/);
assert.match(test,/class="pv-brand-lettering" src="\/telessaude\/teste-aceite\/assets\/telessaude-lettering.svg"/);
assert.match(test,/>Ler informações <span aria-hidden="true">/);
assert.match(test,/Conte com a PromoVie na sua jornada de saúde/);
assert.match(test,/id="pv-brand-info-link"/);
assert.match(test,/href="\/telessaude\/teste-aceite\/informacoes\/" target="_blank" rel="noopener noreferrer"/);
assert.match(entry,/class="pv-test-info-link"/);
assert.match(information,/<html lang="pt-BR">/);
assert.match(information,/<meta name="robots" content="noindex,nofollow,noarchive">/);
assert.match(information,/<span class="eyebrow">Informações<\/span>/);
assert.match(information,/Uma experiência para ajudar você a cuidar da sua saúde/);
assert.match(information,/class="pv-heading-lettering" src="\/telessaude\/teste-aceite\/assets\/telessaude-lettering.svg"/);
assert.match(information,/class="pv-consent-banner"/);
assert.match(information,/class="pv-promo-name">PromoVie<\/strong>/);
assert.match(information,/class="pv-footer-lockup"/);
assert.match(information,/Ao iniciar o Chat Médico, você será convidado/);
assert.match(information,/Leia abaixo a essência desse conteúdo/);
assert.match(information,/document\.querySelector\("\.pv-consent-banner"\)/);
assert.match(directory,/class="pv-directory-lettering"/);
assert.match(directory,/pv-directory-lockup/);
assert.match(directory,/class="pv-lockup-name">PromoVie<\/span>/);
assert.match(information,/Como funciona o atendimento/);
assert.match(information,/Privacidade e consentimento/);
assert.equal((information.match(/<details>/g)||[]).length,2);
assert.match(information,/Você pode copiar o resumo explicativo para consultar depois/);
assert.match(information,/Este material é informativo e complementar/);
assert.doesNotMatch(information,/id="pv-doc-terms"|id="pv-doc-privacy"|widget\.mediquo\.com\/privacy|mediquo-api\.s3/);
assert.doesNotMatch(information,/Consulte os documentos originais|em português|tradução integral/i);
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
 for(const width of [360,390,768,1280]){
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
  const directoryRect=await page.locator(".hub-dialog .pv-directory-lettering").boundingBox();
  assert.ok(directoryRect&&directoryRect.width>80,"Marca do catálogo ilegível");
  assert.ok(Math.abs(directoryRect.width/directoryRect.height-178/29)<.35,
    "Marca do catálogo deformada");
  assert.equal(await page.evaluate(()=>Boolean(window.__sdkOpened)),false);
  assert.equal(await page.locator("#pv-brand-intro").evaluate(d=>d.open),false);
  await page.locator("#hub-native").click();
  await page.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
  await page.waitForFunction(()=>{
    const mark=document.querySelector("#pv-brand-intro .pv-brand-lettering");
    return mark&&mark.complete&&mark.naturalWidth===178&&mark.naturalHeight===29;
  });
  assert.equal((await page.locator("#pv-brand-intro .pv-lockup-name").textContent()).trim(),"PromoVie");
  assert.equal((await page.locator(".topbar .pv-lockup-name").textContent()).trim(),"PromoVie");

  const proportions=await page.evaluate(()=>{
    const measure=selector=>{
      const rect=document.querySelector(selector)?.getBoundingClientRect();
      return rect&&{w:rect.width,h:rect.height,x:rect.x,right:rect.right};
    };
    return [measure(".pv-topbar-lettering"),measure(".pv-brand-lettering"),measure(".pv-directory-lettering")];
  });
  console.log("DEBUG brand geometry before checks:",width,JSON.stringify(proportions));
  for(const mark of proportions.slice(0,2)){
    assert.ok(mark && mark.w>65 && mark.h>9,"Lettering muito pequeno ou ausente");
    assert.ok(Math.abs(mark.w/mark.h-178/29)<0.35,"Lettering deformado "+JSON.stringify(mark));
    assert.ok(mark.x>=0 && mark.right<=width+2,"Lettering fora da tela "+JSON.stringify(mark));
  }
  console.log("Proporções corretas do lettering:",width,JSON.stringify(proportions));

  await page.waitForFunction(()=>{
    const mark=document.querySelector("#pv-brand-intro .pv-brand-lettering");
    try{
      const canvas=document.createElement("canvas"); canvas.width=178; canvas.height=29;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(mark,0,0,178,29);
      const rgba=ctx.getImageData(0,0,178,29).data;
      for(let i=0;i<rgba.length;i+=4){
        if(rgba[i+3]>150 && rgba[i]<155 && rgba[i+1]<105 && rgba[i+2]>75 && rgba[i+2]<195)return true;
      }
    }catch(error){return false}
    return false;
  },{timeout:10000});
  assert.equal(await page.evaluate(()=>document.querySelector("#pv-brand-intro-title").textContent.trim()),
    "Sua saúde merece uma experiência excelente.");
  const popupPromise=page.waitForEvent("popup");
  await page.locator("#pv-brand-info-link").click();
  const popup=await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  assert.equal(new URL(popup.url()).pathname,"/telessaude/teste-aceite/informacoes/");
  assert.equal(await popup.locator("html").getAttribute("lang"),"pt-BR");
  assert.match(await popup.locator("h1").textContent(),/Uma experiência para ajudar você a cuidar da sua saúde/);
  await popup.locator(".pv-consent-banner").waitFor();
  assert.match(await popup.locator(".pv-consent-banner").textContent(),/Ao iniciar o Chat Médico, você será convidado/);
  await popup.waitForFunction(()=>{
    const mark=document.querySelector(".pv-heading-lettering");
    return mark&&mark.complete&&mark.naturalWidth===178&&mark.naturalHeight===29;
  });
  assert.equal(await popup.locator(".brand img.pv-heading-lettering").getAttribute("alt"),"Telessaúde");

  for(const vw of [320,360,390,430,600,768,1024,1440]){
    await popup.setViewportSize({width:vw,height:850});
    const layout=await popup.evaluate(()=>{
      const rect=sel=>{const r=document.querySelector(sel)?.getBoundingClientRect();
        return r&&{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {scroll:document.documentElement.scrollWidth,
        logo:rect(".pv-heading-lettering"),footer:rect(".pv-footer-lockup img"),
        brand:rect(".brand"),button:rect("#close-info")};
    });
    assert.ok(layout.scroll<=vw+2,"Rolagem horizontal em "+vw);
    assert.ok(layout.logo && layout.logo.width>90,"Logo ilegível "+vw);
    assert.ok(Math.abs(layout.logo.width/layout.logo.height-178/29)<.35,"Logo distorcido "+vw);
    assert.ok(layout.logo.right<=vw+2 && layout.logo.x>=0,"Logo sai da tela "+vw);
    assert.ok(Math.abs(layout.footer.width/layout.footer.height-178/29)<.35,"Rodapé distorcido "+vw);
    assert.ok(layout.brand.bottom<=layout.button.y+1 || layout.brand.right<=layout.button.x+1,
      "Marca sobreposta ao botão "+vw);
    console.log("Layout página informações:",vw,JSON.stringify(layout));
  }
  await popup.setViewportSize({width,height:850});

  const details=popup.locator("#resumo-pt details");
  assert.equal(await details.count(),2);
  assert.equal(await details.nth(0).evaluate(x=>x.open),false);
  await details.nth(0).locator("summary").click();
  assert.equal(await details.nth(0).evaluate(x=>x.open),true);
  assert.equal(await details.nth(0).locator("h3").first().isVisible(),true);
  await details.nth(1).locator("summary").click();
  assert.equal(await details.nth(1).evaluate(x=>x.open),true);
  assert.equal(await popup.locator("#pv-doc-terms").count(),0);
  assert.equal(await popup.locator("#pv-doc-privacy").count(),0);
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
