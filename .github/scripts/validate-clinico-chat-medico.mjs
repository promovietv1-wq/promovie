import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const moduleCode=await readFile("telesaude/diretorio-especialidades-20261107.mjs","utf8");
const base=await readFile("telesaude/atendimento-especialidades-20261107/index.html","utf8");
const prod=await readFile("telesaude/atendimento/index.html","utf8");
const original=await readFile("telesaude/atendimento-20261107/index.html","utf8");
assert.match(moduleCode,/Abrir Chat Médico 24h/);
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
      environment:"production",createdAt:Date.now(),directoryToken:"D".repeat(43)
    }));
    const previousFetch=window.fetch.bind(window);
    window.fetch=(resource,options)=>{
      if(String(resource).includes("/api/promovie/directory/v1/catalog")){
        return Promise.resolve(new Response(JSON.stringify({available:rows.length>0,items:rows}),{
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
    const cards=page.locator("#hub-category-grid .hub-category");
    await cards.first().click();
    await page.locator(".hub-clinical-native").waitFor();
    assert.match(await page.locator(".hub-clinical-fallback").innerText(),/Clínico geral 24h/);
    await page.locator(".hub-clinical-native").click();
    await page.waitForFunction(()=>!document.getElementById("directory-dialog").open);
    assert.ok(await page.evaluate(()=>window.__widgetOpens>=2));
    assert.equal(await page.evaluate(()=>window.__navigation||null),null);
    await page.close();
    console.log("Clínico 24h sem lista individual, Chat Médico simulado:",width);
  }
  const direct=await createPage(390,[
    {id:"professional-123",name:"Dr. Teste",title:"Médico generalista",
      description:"Atendimento clínico."},
    {id:"nutrition-222",name:"Nutri Exemplo",title:"Nutrição"}
  ]);
  await direct.locator("#hub-category-grid .hub-category").first().click();
  await direct.locator("button.hub-person").first().click();
  assert.equal(await direct.locator("#hub-profile .hub-profile-copy h3").innerText(),"Dr. Teste");
  await direct.locator("#hub-open").click();
  await direct.waitForFunction(()=>!document.getElementById("directory-dialog").open);
  assert.equal(await direct.evaluate(()=>window.__navigation),"/professionals/professional-123/room");
  await direct.close();
  console.log("Profissional clínico individual: rota original simulada.");
}finally{await browser.close();}
console.log("Aprovado: sem consulta real e sem simular disponibilidade clínica.");
