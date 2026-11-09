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
assert.match(profiles,/\/professionals\/"\+encodeURIComponent\(p.id\)\+"\/room"/);
assert.match(profiles,/Abrir no Chat Médico ›/);
assert.doesNotMatch(profiles,/if\(p\)showProfile\(p\)/);
assert.doesNotMatch(profiles,/if\(p\)showChatProfile\(p\)/);

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
const originalCategoryImages=[
 "00b6385598f04689b78e7cee1297814d",
 "9f18304381da41df9cd6b4de3296510a",
 "ed9bfd930b8a40bcb7a2ba19653a8848",
 "4167b1bf6d6241abbd0c2284024de025",
 "4165a6f5bdea484ca54cbce4ac2d42ba",
 "f20e162c4a874ff8b7f77c37f2f27e07",
 "89eb9cace0394a9783156d5c9d3e05c1",
 "332637580c72430295e77ea81c0d6e2a"
];
const browser=await chromium.launch({headless:true});
async function setup(width){
 const page=await browser.newPage({viewport:{width,height:850}});
 await page.route("https://widget.mediquo.com/js/1.0.0/mediquo.js",r=>r.fulfill({
   status:200,contentType:"application/javascript",
   body:"window.MediquoWidget={init:async()=>{window.__sdkInit=(window.__sdkInit||0)+1},open:async()=>{window.__sdkOpen=(window.__sdkOpen||0)+1},navigate:path=>{window.__sdkRoute=path}};"
 }));
 // Fotografias ilustrativas retiradas da página principal PromoVie.
 // Fazemos mock apenas no navegador de CI, mantendo o código de produção intacto.
 await page.route("https://static.wixstatic.com/media/**",r=>r.fulfill({
   status:200,contentType:"image/gif",
   body:Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==","base64")
 }));
 await page.route("https://api.mediquo.com/profile/test.svg",r=>r.fulfill({
   status:200,contentType:"image/svg+xml",
   body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ccc"/></svg>'
 }));
 await page.addInitScript(items=>{
   sessionStorage.setItem("promovie:mediquo:handoff:v1",JSON.stringify({
     apiKey:"TEST-WIDGET-API-KEY",accessToken:"TEST-ACCESS-TOKEN-FAKE-ONLY-123456789",
     environment:"production",createdAt:Date.now(),
     directoryToken:"G".repeat(43),
     spaceBootstrap:{
       token:"T".repeat(43),mode:"new",salt:"c2_"+"S".repeat(22),
       key:"A".repeat(43),createdAt:Date.now()
     }
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
 await page.locator(".space-footer:not([hidden])").waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.classList.contains("space-link-ready")),true,
   "O acesso ao Meu Espaço deve ficar visível após validar a sessão efêmera");
 assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0,"A lista médica não deve abrir antes da escolha");
 const visual=await page.evaluate(()=>{
   const overlay=getComputedStyle(document.body,"::before");
   const modalBackdrop=getComputedStyle(document.querySelector("#directory-dialog"),"::backdrop");
   return {
     mode:document.body.classList.contains("pv-navigation-mode"),
     overlayTop:overlay.top,overlayBottom:overlay.bottom,
     overlayLeft:overlay.left,overlayRight:overlay.right,
     overlayStack:Number(overlay.zIndex),
     overlayImage:overlay.backgroundImage,
     overlayPointer:overlay.pointerEvents,
     backdropColor:modalBackdrop.backgroundColor
   };
 });
 assert.equal(visual.mode,true,"Especialidades deve manter fundo neutro ativo");
 for(const value of [visual.overlayTop,visual.overlayBottom,visual.overlayLeft,visual.overlayRight])
   assert.equal(value,"0px","O fundo deve cobrir toda a janela, incluindo topo e rodapé");
 assert.ok(visual.overlayStack>2147483640,"O fundo deve encobrir a barra da TeleSaúde");
 assert.match(visual.overlayImage,/linear-gradient/);
 assert.match(visual.overlayImage,/radial-gradient/);
 assert.equal(visual.overlayPointer,"none","O fundo não deve bloquear cliques");
 assert.equal(visual.backdropColor,"rgba(0, 0, 0, 0)");
 return page;
}
try{
 for(const width of [375,900,1280]){
   const page=await setup(width);
   const cards=page.locator("#hub-category-grid .hub-category");
   assert.equal(await cards.count(),8);
   assert.equal(await page.locator(".hub-exit").count(),1);
   assert.equal(await page.locator(".hub-exit").innerText(),"← Voltar às especialidades");
   assert.equal(await page.locator(".hub-exit").isVisible(),false);
   assert.equal(await page.locator("#hub-nav").count(),0,
     "O botão de voltar antigo não pode permanecer embaixo do cabeçalho");
   assert.equal(await page.locator("a[aria-label='Sair da TeleSaúde']").count(),0);
   const modal=await page.locator("#directory-dialog").boundingBox();
   assert.ok(modal&&modal.width<=813,"A janela deve ter até 812px no desktop");
   const brand=page.locator("#directory-dialog .hub-brand-strip");
   assert.equal(await brand.count(),1);
   assert.equal(await brand.locator("strong").innerText(),"TeleSaúde PromoVie");
   assert.match(await brand.locator("img").getAttribute("src"),/coracao-promovie-com-logo\.webp/);
   assert.equal(await brand.locator("img").getAttribute("alt"),"");
   assert.equal(await page.locator(".hub-category-photo .hub-category-image").count(),8);
   assert.equal(await page.locator(".hub-category-photo .hub-category-mark").count(),0);
   assert.equal(await page.locator(".hub-category-photo .hub-arrow").count(),0);
   for(let i=0;i<8;i++){
     const card=cards.nth(i);
     const image=card.locator(".hub-category-image");
     assert.match(await image.getAttribute("src"),new RegExp(originalCategoryImages[i]));
     assert.equal(await image.getAttribute("alt"),"");
     assert.equal(await card.locator(".hub-category-body").count(),1);
     assert.equal(await card.locator(".hub-category-mark").count(),0);
     assert.equal(await card.locator(".hub-arrow").count(),0);
   }
   assert.equal(await cards.nth(7).locator("strong").innerText(),"Pet (cães e gatos)");
   assert.equal(await cards.nth(7).locator(".hub-pet-detail").evaluate(el=>getComputedStyle(el).fontWeight),"400");
   assert.equal(await cards.nth(4).locator(".hub-kind").innerText(),"Até 10 min · em horário disponível");
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector(".hub-category-image")).objectFit),"cover");
   const expectedColumns=width>=1091?4:width>=746?3:width>=541?2:1;
   assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector(".hub-grid")).gridTemplateColumns.split(" ").length),expectedColumns);
   const picture=await cards.first().locator(".hub-category-image").boundingBox();
   const tile=await cards.first().boundingBox();
   assert.ok(picture&&tile,"Imagem e card precisam aparecer em tamanho calculável");
   assert.ok(Math.abs(picture.width/picture.height-16/9)<0.08,
     "Imagem da especialidade deve permanecer horizontal, 16:9, sem distorção");
   assert.ok(tile.width/tile.height>=0.92,
     "O card não pode ficar excessivamente alto ou estreito");
   await cards.nth(1).click();
   assert.equal(await page.locator("#hub-top-back").isVisible(),true);
   await page.locator("#hub-top-back").click();
   assert.equal(await page.locator("#hub-categories").isVisible(),true);
   assert.equal(await page.locator("#hub-top-back").isVisible(),false);
   await cards.nth(1).click();
   assert.equal(await page.locator("#hub-professionals .hub-person").count(),2);
   const alice=page.locator("#hub-professionals .hub-person").filter({hasText:"Alicia Rodrigues"}).first();
   await alice.locator(".hub-avatar.photo-ready img").waitFor();
   assert.equal(await alice.locator(".hub-avatar img").getAttribute("alt"),"Foto de Alicia Rodrigues");
   assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0);
   assert.equal(await alice.locator(".hub-person-arrow").innerText(),"Abrir no Chat Médico ›");
   await alice.click();
   await page.waitForFunction(()=>window.__sdkRoute==="/professionals/p-psicologia-01/room");
   assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
   assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
   assert.equal(await page.locator("#hub-profile").isVisible(),false);
   assert.equal(await page.evaluate(()=>document.body.classList.contains("pv-navigation-mode")),false,
     "O Chat Médico deve voltar a ser visível só depois da escolha");
   await page.close();
   console.log("Foto e clique direto no profissional sem prévia intermediária:",width);
 }
 // Busca unificada: nome próprio, profissão, prefixo e especialidade.
 const unified=await setup(390);
 const field=unified.locator("#hub-global-query");
 assert.equal(await field.getAttribute("placeholder"),"Buscar profissional ou especialidade");
 await field.fill("p");
 assert.equal(await unified.locator("#hub-category-grid").isVisible(),false);
 assert.equal(await unified.locator("#hub-global-results").isVisible(),true);
 assert.equal(await unified.locator("#hub-global-results .hub-search-category[data-speciality='Psicologia']").count(),1);
 assert.equal(await unified.evaluate(()=>window.__sdkOpen||0),0);
 await field.fill("psico");
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").count(),1);
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").first().getAttribute("data-speciality"),"Psicologia");
 assert.equal(await unified.locator("#hub-global-results .hub-person").count(),2);
 await unified.locator("#hub-global-results .hub-search-category").first().click();
 assert.equal(await unified.locator("#hub-service-title").innerText(),"Psicologia");
 assert.equal(await unified.locator("#hub-professionals .hub-person").count(),2);
 await unified.locator("#hub-top-back").click();
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").count(),1);
 await field.fill("psicólogos");
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").first().getAttribute("data-speciality"),"Psicologia");
 await field.fill("dermato");
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").first().getAttribute("data-speciality"),"Dermatologia");
 await unified.locator("#hub-global-results .hub-search-category").first().click();
 assert.equal(await unified.locator("#hub-service-title").innerText(),"Dermatologia");
 await unified.locator("#hub-top-back").click();
 await field.fill("Alicia");
 assert.equal(await unified.locator("#hub-global-results .hub-search-category").count(),0);
 assert.equal(await unified.locator("#hub-global-results .hub-person").count(),1);
 await unified.locator("#hub-global-results .hub-person").first().click();
 await unified.waitForFunction(()=>window.__sdkRoute==="/professionals/p-psicologia-01/room");
 assert.equal(await unified.evaluate(()=>window.__sdkOpen),1);
 await unified.close();
 console.log("Pesquisa por P, psico, psicólogos, dermato e nomes verificada.");
 const tablet=await setup(700);
 assert.equal(await tablet.evaluate(()=>getComputedStyle(document.querySelector(".hub-grid")).gridTemplateColumns.split(" ").length),2);
 await tablet.close();
 const tiny=await setup(320);
 assert.equal(await tiny.locator(".hub-category-photo .hub-category-image").count(),8);
 assert.equal(await tiny.evaluate(()=>getComputedStyle(document.querySelector(".hub-grid")).gridTemplateColumns.split(" ").length),1);
 await tiny.close();
 const page=await setup(390);
 await page.locator("#hub-global-query").fill("Ana Paula");
 const general=page.locator("#hub-global-results .hub-person").first();
 await general.waitFor();
 assert.equal(await page.evaluate(()=>window.__sdkOpen||0),0);
 await general.click();
 await page.waitForFunction(()=>window.__sdkRoute==="/professionals/p-nutricao-02/room");
 assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
 assert.equal(await page.locator("#hub-profile").isVisible(),false);
 await page.locator("#directory-open").click();
 await page.locator("#directory-dialog[open]").waitFor();
 await page.locator("#hub-native").click();
 assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
 await page.locator("#chat-search-name").fill("Alicia");
 const search=page.locator("#chat-search-results");
 await search.locator(".chat-search-person").first().waitFor();
 assert.equal(await page.locator("#directory-dialog").evaluate(el=>el.open),false);
 await search.locator(".chat-search-person").first().click();
 await page.waitForFunction(()=>window.__sdkRoute==="/professionals/p-psicologia-01/room");
 assert.equal(await page.evaluate(()=>window.__sdkOpen),1);
 assert.equal(await search.isVisible(),false);
 assert.equal(await page.locator("#hub-profile").isVisible(),false);
 await page.close();
 console.log("Busca geral e busca inline abriram conversa diretamente, sem tela intermediária.");
 
 // Meu Espaço deve abrir na própria tela e voltar ao ponto de origem,
 // sem nova aba, perda de sessão nem reinício do SDK.
 for(const width of [390,1280]){
   const space=await setup(width);
   const initialPageCount=space.context().pages().length;
   await space.locator("#hub-category-grid .hub-category").nth(1).click();
   assert.equal(await space.locator("#hub-professionals").isVisible(),true);
   assert.equal(await space.evaluate(()=>window.__sdkOpen||0),0);
   await space.locator("#hub-shortcut-space").click();
   await space.locator("#space-embedded:not([hidden])").waitFor();
   assert.equal(await space.locator("#space-embedded-back").innerText(),"← Voltar às Especialidades");
   assert.equal(space.context().pages().length,initialPageCount,
     "O Meu Espaço não pode abrir outra aba no laboratório de perfis");
   assert.match(await space.locator("#space-embedded-frame").getAttribute("src")||await space.locator("#space-embedded-frame").evaluate(el=>el.contentWindow.location.href),
     /\/telesaude\/meu-espaco\//);
   // A página de carregamento interna nunca deve aparecer enquanto o
   // usuário aguarda o Meu Espaço; só exibimos o iframe já preparado.
   await space.frameLocator("#space-embedded-frame").locator("#loading-view").waitFor({state:"attached"});
   const loadingState=await space.locator("#space-embedded").evaluate(layer=>({
     preparing:layer.classList.contains("is-preparing"),
     wait:layer.querySelector("#space-embedded-wait").hidden,
     iframeVisibility:getComputedStyle(layer.querySelector("iframe")).visibility
   }));
   if(loadingState.preparing){
     assert.equal(loadingState.wait,false);
     assert.equal(loadingState.iframeVisibility,"hidden");
     await space.frameLocator("#space-embedded-frame").locator("#loading-view").evaluate(el=>{
       el.hidden=true;
       document.getElementById("workspace-view").hidden=false;
     });
     await space.waitForFunction(()=>!document.getElementById("space-embedded").classList.contains("is-preparing"));
   }
   assert.equal(await space.locator("#space-embedded-wait").isVisible(),false);
   assert.equal(await space.locator("#space-embedded-frame").evaluate(el=>getComputedStyle(el).visibility),"visible");
   // Agendamentos abre o painel oficial da própria TeleSaúde, sobre os
   // registros ainda abertos. Fechar devolve ao mesmo Meu Espaço.
   const embeddedSpace=space.frameLocator("#space-embedded-frame");
   // O teste não possui um cofre real. A autenticação sintética do iframe
   // pode passar depois da exibição simulada e ocultar novamente os registros.
   // Fixar somente o estado visual de trabalho antes do clique de navegação.
   await embeddedSpace.locator("#workspace-view").evaluate(el=>{
     el.hidden=false;
     const doc=el.ownerDocument;
     for(const id of ["login-view","unlock-view","loading-view"])doc.getElementById(id).hidden=true;
   });
   assert.equal(await embeddedSpace.locator("#space-appointments").evaluate(el=>el.hidden),false,
     "Agendamentos deve estar habilitado somente no laboratório de perfis");
   assert.equal(await embeddedSpace.locator("#space-appointments").isVisible(),true,
     "O atalho deve estar visível enquanto Meus registros estiver aberto");
   assert.equal(await embeddedSpace.locator("#space-appointments").innerText(),"Agendamentos");
   await embeddedSpace.locator("#allergies").fill("Anotação local de teste, sem dados reais");
   await embeddedSpace.locator("#space-appointments").click();
   await space.locator("#appointments-dialog[open]").waitFor();
   assert.equal(await space.locator("#appointments-dialog .agenda-modal-link").count(),1);
   assert.equal(await space.locator("#appointments-dialog").innerText().then(text=>/suporte e dúvidas/i.test(text)),false);
   assert.equal(await space.locator("#appointments-dialog a[href*=AgndrCon]").count(),0);
   assert.equal(await space.locator("#promovie-mensagem-abrir").count(),1,
     "Deve oferecer mensagens PromoVie sem acesso externo ao fornecedor");
   await space.locator("#promovie-mensagem-abrir").click();
   await space.locator("#promovie-mensagem-dialog[open]").waitFor();
   assert.equal(await space.locator("#promovie-mensagem-texto").isDisabled(),true,
     "Não permitir envio sem canal bidirecional seguro configurado");
   assert.equal(await space.locator('#promovie-mensagem-dialog a[href*="wa.me"]').count(),0);
   await space.locator("#promovie-mensagem-fechar").click();
   await space.waitForFunction(()=>!document.getElementById("promovie-mensagem-dialog").open);
   assert.equal(await space.locator("#space-embedded").evaluate(el=>el.hidden),false);
   assert.equal(await space.evaluate(()=>window.__sdkOpen||0),0,
     "Agendamentos não deve ativar o Chat Médico");
   await space.locator("#appointments-dialog [data-agenda-close]").click();
   await space.waitForFunction(()=>!document.getElementById("appointments-dialog").open);
   assert.equal(await space.locator("#space-embedded").evaluate(el=>el.hidden),false,
     "Ao fechar Agendamentos, permanecer em Meu Espaço");
   assert.equal(await embeddedSpace.locator("#allergies").inputValue(),
     "Anotação local de teste, sem dados reais");
   assert.equal(space.context().pages().length,initialPageCount);
   await space.locator("#space-embedded-back").click();
   await space.locator("#directory-dialog[open]").waitFor();
   assert.equal(await space.locator("#space-embedded").evaluate(el=>el.hidden),true);
   assert.equal(await space.locator("#hub-professionals").isVisible(),true,
     "Retorno deve preservar a lista de Psicologia");
   assert.equal(await space.evaluate(()=>window.__sdkOpen||0),0,
     "Meu Espaço não pode abrir o Chat Médico no retorno");
   await space.close();
   console.log("Botão voltar do Meu Espaço à especialidade:",width);
 }
 const fromChat=await setup(1280);
 await fromChat.locator("#hub-native").click();
 await fromChat.waitForFunction(()=>window.__sdkOpen===1);
 await fromChat.locator(".space-entry").click();
 await fromChat.locator("#space-embedded:not([hidden])").waitFor();
 assert.equal(await fromChat.locator("#space-embedded-back").innerText(),"← Voltar ao Chat Médico");
 assert.equal(fromChat.context().pages().length,1);
 // Testa também o botão Voltar do navegador.
 await fromChat.goBack();
 await fromChat.waitForFunction(()=>document.getElementById("space-embedded").hidden);
 assert.equal(await fromChat.locator("#directory-dialog").evaluate(el=>el.open),false);
 assert.equal(await fromChat.locator("#chat-search-shell").isVisible(),true);
 assert.equal(await fromChat.evaluate(()=>window.__sdkOpen),1,
   "O Chat Médico deve permanecer na mesma sessão");
 await fromChat.close();
 console.log("Voltar do navegador: Meu Espaço -> Chat Médico, sem reiniciar a sessão.");
}finally{
 await browser.close();
}
console.log("Cards com oito imagens do site oficial e fluxo de clique direto testados com SDK simulado. Atendimento real não foi verificado.");
