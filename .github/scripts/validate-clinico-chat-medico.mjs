import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const moduleCode=await readFile("telesaude/diretorio-especialidades-20261107.mjs","utf8");
const base=await readFile("telesaude/atendimento-especialidades-20261107/index.html","utf8");
const prod=await readFile("telesaude/atendimento/index.html","utf8");
const original=await readFile("telesaude/atendimento-20261107/index.html","utf8");
assert.match(moduleCode,/A bolinha verde identifica os profissionais que estão on-line/);
assert.match(moduleCode,/\/professionals\/"\+encodeURIComponent\(chosenPerson\.id\)\+"\/room"/);
assert.match(base,/MediquoWidget/);
assert.doesNotMatch(prod,/diretorio-especialidades-20261107/);
assert.doesNotMatch(original,/diretorio-especialidades-20261107/);
const browser=await chromium.launch({headless:true});
async function createPage(width,items){
  const page=await browser.newPage({viewport:{width,height:850}});
  await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",route=>route.fulfill({
    status:200,contentType:"application/javascript",
    body:"window.MediquoWidget={init:async()=>{},open:async()=>{window.__widgetOpens=(window.__widgetOpens||0)+1},navigate:path=>{window.__navigation=path},open_room:id=>{window.__room=id}};"
  }));
  await page.addInitScript(rows=>{
    sessionStorage.setItem("promovie:mediquo:handoff:v1",JSON.stringify({
      apiKey:"NOT-A-REAL-KEY",accessToken:"X".repeat(45),
      environment:"production",createdAt:Date.now(),directoryToken:"D".repeat(43),
      spaceBootstrap:{
        token:"T".repeat(43),mode:"new",salt:"c2_"+"S".repeat(22),
        key:"A".repeat(43),createdAt:Date.now()
      }
    }));
    const previousFetch=window.fetch.bind(window);
    window.fetch=(resource,options)=>{
      if(String(resource).includes("/api/promovie/directory/v1/catalog")){
        return Promise.resolve(new Response(JSON.stringify({available:rows.length>0,items:rows}),{
          status:200,headers:{"content-type":"application/json"}
        }));
      }
      if(String(resource).includes("/api/promovie/space/v1/health")){
        return Promise.resolve(new Response(JSON.stringify({disponivel:true}),{
          status:200,headers:{"content-type":"application/json"}
        }));
      }
      if(String(resource).includes("/api/promovie/space/v1/vault")){
        return Promise.resolve(new Response(JSON.stringify({record:null,revision:0}),{
          status:200,headers:{"content-type":"application/json"}
        }));
      }
      return previousFetch(resource,options);
    };
  },items);
  await page.goto("http://127.0.0.1:8779/telesaude/atendimento-especialidades-20261107/",{waitUntil:"domcontentloaded"});
  await page.locator("#directory-dialog[open]").waitFor();
  await page.locator(".hub-category").first().waitFor();
  return page;
}
try{
  for(const width of [375,1280]){
    const page=await createPage(width,[
      {id:"p01",name:"Psicóloga Exemplo",title:"Psicologia"}
    ]);
    assert.equal(await page.locator("#hub-category-grid .hub-category").count(),8);
    assert.equal(await page.locator("#hub-global-query").getAttribute("placeholder"),"Buscar pelo nome");
    const cards=page.locator("#hub-category-grid .hub-category");
    assert.equal(await cards.nth(7).locator("strong").innerText(),"Pet (cães e gatos)");
    assert.equal(await cards.nth(7).locator(".hub-pet-detail").innerText(),"(cães e gatos)");
    assert.equal(await cards.nth(7).locator(".hub-pet-detail").evaluate(el=>getComputedStyle(el).fontWeight),"400");
    assert.equal(await page.locator(".hub-exit").innerText(),"Sair da TeleSaúde");
    await cards.nth(4).locator(".hub-count").waitFor();
    assert.equal(await cards.nth(4).locator(".hub-count").innerText(),"Acesso pelo Chat Médico");
    assert.equal(await page.locator("#hub-shortcut-specialties").count(),0);
    assert.equal(await page.locator("#hub-shortcut-appointments").innerText(),"Agendamentos");
    assert.equal(await page.locator("#hub-shortcut-space").innerText(),"Meu Espaço de Saúde");
    assert.equal(await page.locator(".hub-shortcuts button").count(),2);
    await page.waitForFunction(()=>window.__widgetOpens===1);
    await page.locator("#hub-shortcut-appointments").click();
    await page.locator("#appointments-dialog[open]").waitFor();
    assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
    assert.equal(await page.locator(".agenda-modal-link").first().getAttribute("href"),
      "https://tinyurl.com/agendamq");
    // Fechar a agenda deve voltar à seleção, sem abrir a interface médica.
    await page.locator("[data-agenda-close]").click();
    await page.locator("#directory-dialog[open]").waitFor();
    assert.equal(await page.evaluate(()=>window.__widgetOpens),1);
    await cards.first().click();
    await page.locator(".hub-clinical-fallback").waitFor();
    assert.equal(await page.locator("#directory-title").innerText(),"Plantão com médico clínico geral adulto e infantil");
    assert.match(await page.locator(".hub-clinical-fallback").innerText(),/bolinha verde identifica/);
    assert.equal(await page.locator("#hub-professionals .hub-search").isVisible(),false);
    assert.equal(await page.locator(".hub-section-title").isVisible(),false);
    assert.equal(await page.locator("#hub-native").innerText(),"Chat Médico");
    await page.locator("#hub-native").click();
    await page.waitForFunction(()=>!document.getElementById("directory-dialog").open);
    assert.ok(await page.evaluate(()=>window.__widgetOpens>=2));
    assert.equal(await page.evaluate(()=>window.__navigation||null),null);
    assert.equal(await page.locator("#chat-search-shell").isVisible(),true);
    assert.equal(await page.locator("#chat-search-name").getAttribute("placeholder"),"Buscar pelo nome");
    await page.close();
    console.log("Clínico 24h sem lista individual, Chat Médico simulado:",width);
  }
  // O acesso ao Meu Espaço, as saídas da agenda e o Chat Médico são escolhas distintas.
  const navigation=await createPage(390,[
    {id:"veter-1",name:"Dra. Veterinária",title:"Veterinária"},
    {id:"other-1",name:"Dr. Outra Área",title:"Cardiologia"}
  ]);
  await navigation.waitForFunction(()=>window.__widgetOpens===1);
  const navCards=navigation.locator("#hub-category-grid .hub-category");
  assert.equal(await navCards.count(),8);
  assert.equal(await navCards.nth(7).locator("strong").innerText(),"Pet (cães e gatos)");
  assert.equal(await navigation.locator("#hub-category-grid .hub-category", {hasText:"Outras especialidades"}).count(),0);
  // A especialidade extra deixa de ser um cartão, mas seus profissionais ainda são pesquisáveis.
  await navigation.locator("#hub-global-query").fill("Outra");
  await navigation.locator("#hub-global-results .hub-person").first().waitFor();
  assert.match(await navigation.locator("#hub-global-results .hub-person").first().innerText(),/Dr. Outra Área/);
  assert.equal(await navigation.locator("#hub-category-grid").isVisible(),false);
  await navigation.locator("#hub-global-results .hub-person").first().click();
  assert.match(await navigation.locator("#hub-profile .hub-profile-copy h3").innerText(),/Dr. Outra Área/);
  await navigation.locator("#hub-back").click();
  await navigation.locator("#hub-global-query").fill("");
  assert.equal(await navigation.locator("#hub-category-grid").isVisible(),true);
  assert.equal(await navigation.locator("#hub-shortcut-specialties").count(),0);
  assert.equal(await navigation.locator(".hub-shortcuts button").count(),2);
  await navCards.nth(7).click();
  assert.equal(await navigation.locator("#hub-service-title").innerText(),"Pet (cães e gatos)");
  assert.equal(await navigation.locator("#hub-professionals .hub-search").isVisible(),false);
  assert.equal(await navigation.locator(".hub-person").count(),1);
  await navigation.locator("#hub-back").click();
  await navigation.locator("#hub-shortcut-appointments").click();
  await navigation.locator("#appointments-dialog[open]").waitFor();
  await navigation.locator("#appointments-specialties").click();
  await navigation.locator("#directory-dialog[open]").waitFor();
  assert.equal(await navigation.evaluate(()=>window.__widgetOpens),1);
  // Entrar no Meu Espaço a partir de uma especialidade e voltar à MESMA lista.
  await navigation.locator("#hub-category-grid .hub-category").nth(7).click();
  await navigation.locator(".space-footer:not([hidden])").waitFor();
  await navigation.locator("#hub-shortcut-space").click();
  await navigation.locator("#space-embedded:not([hidden])").waitFor();
  assert.equal(await navigation.locator("#space-embedded-back").innerText(),"← Voltar às Especialidades");
  await navigation.frameLocator("#space-embedded-frame").locator("html.pv-space-embedded").waitFor();
  await navigation.locator("#space-embedded-back").click();
  await navigation.locator("#directory-dialog[open]").waitFor();
  assert.equal(await navigation.locator("#hub-service-title").innerText(),"Pet (cães e gatos)");
  assert.equal(await navigation.locator("#hub-professionals").isVisible(),true);
  assert.equal(await navigation.evaluate(()=>window.__widgetOpens),1);
  await navigation.locator("#hub-back").click();
  await navigation.locator("#hub-shortcut-appointments").click();
  await navigation.locator("#appointments-dialog[open]").waitFor();
  await navigation.locator("#appointments-chat").click();
  await navigation.waitForFunction(()=>window.__widgetOpens===2);
  assert.equal(await navigation.locator("#directory-dialog").evaluate(el=>el.open),false);
  assert.equal(await navigation.locator("#appointments-dialog").evaluate(el=>el.open),false);
  assert.equal(await navigation.locator("#chat-search-shell").isVisible(),true);
  // Ao abrir pelo Chat Médico, o botão Voltar deve preservar o chat.
  await navigation.locator(".space-footer:not([hidden])").waitFor();
  await navigation.locator(".space-entry").click();
  await navigation.locator("#space-embedded:not([hidden])").waitFor();
  assert.equal(await navigation.locator("#space-embedded-back").innerText(),"← Voltar ao Chat Médico");
  await navigation.locator("#space-embedded-back").click();
  await navigation.waitForFunction(()=>document.getElementById("space-embedded").hidden);
  assert.equal(await navigation.locator("#directory-dialog").evaluate(el=>el.open),false);
  assert.equal(await navigation.locator("#chat-search-shell").isVisible(),true);
  assert.equal(await navigation.evaluate(()=>window.__widgetOpens),2);
  await navigation.locator("#chat-search-name").click();
  await navigation.locator("#directory-dialog[open]").waitFor();
  await navigation.locator("#hub-global-query").fill("Veterinária");
  assert.match(await navigation.locator("#hub-global-results .hub-person").first().innerText(),/Dra. Veterinária/);
  await navigation.locator("#hub-global-query").fill("");
  await navigation.locator("#hub-native").click();
  await navigation.locator("#chat-search-shell").waitFor();
  await navigation.locator("#directory-open").click();
  await navigation.locator("#directory-dialog[open]").waitFor();
  await navigation.close();
  console.log("Navegação autônoma, Meu Espaço, agendamento e retorno às especialidades: aprovada.");

  const direct=await createPage(390,[
    {id:"professional-123",name:"Dr. Teste",title:"Médico generalista",
      description:"Atendimento clínico."},
    {id:"nutrition-222",name:"Nutri Exemplo",title:"Nutrição"},
    {id:"psych-1",name:"Psicóloga Ana",title:"Psicologia"},
    {id:"psych-2",name:"Psicóloga Beatriz",title:"Psicologia"}
  ]);
  await direct.locator("#hub-category-grid .hub-category").nth(1).click();
  assert.equal(await direct.locator("#hub-service-title").innerText(),"Psicologia");
  assert.equal(await direct.locator("#hub-professionals .hub-search").isVisible(),true);
  await direct.locator("#hub-query").fill("Beatriz");
  assert.equal(await direct.locator("#hub-professionals .hub-person").count(),1);
  assert.match(await direct.locator("#hub-professionals .hub-person").first().innerText(),/Beatriz/);
  await direct.locator("#hub-back").click();
  await direct.locator("#hub-category-grid .hub-category").nth(2).click();
  assert.equal(await direct.locator("#hub-professionals .hub-search").isVisible(),false);
  await direct.locator("#hub-back").click();
  await direct.locator("#hub-category-grid .hub-category").first().click();
  assert.equal(await direct.locator("#hub-professionals .hub-search").isVisible(),false);
  await direct.locator("button.hub-person").first().click();
  assert.equal(await direct.locator("#hub-profile .hub-profile-copy h3").innerText(),"Dr. Teste");
  await direct.locator("#hub-open").click();
  await direct.waitForFunction(()=>!document.getElementById("directory-dialog").open);
  assert.equal(await direct.evaluate(()=>window.__navigation),"/professionals/professional-123/room");
  assert.equal(await direct.evaluate(()=>document.body.classList.contains("pv-navigation-mode")),false);
  await direct.close();
  console.log("Profissional clínico individual: rota original simulada.");
}finally{await browser.close();}
console.log("Aprovado: sem consulta real e sem simular disponibilidade clínica.");
