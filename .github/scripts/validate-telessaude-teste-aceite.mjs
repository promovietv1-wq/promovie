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
assert.ok(!attendance.includes('Os atendimentos clínicos são realizados por profissionais habilitados, conforme suas atribuições e responsabilidades.'));
assert.ok(!attendance.includes('id="appointments-my-panel"'));
assert.ok(attendance.includes('>Agendar consulta</span>'));
assert.ok(directory.includes('url.origin==="https://profissionais-telessaude.vercel.app"'));

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
 for(const width of [390,768,1280]){
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

   // Voltar visível nunca exige confirmar os documentos.
   await first.locator("#pv-brand-info-link").click();
   await first.locator("#pv-information-dialog[open]").waitFor({timeout:10000});
   const info=first.frameLocator("#pv-information-frame");
   await info.locator("#back-info").waitFor();
   assert.equal(await info.locator("#info-title").count(),0,"Introdução redundante deve sair");
   assert.equal(await info.locator(".hero .intro").count(),0);
   const src=await first.locator("#pv-information-frame").evaluate(frame=>frame.contentWindow.location.href);
   assert.match(new URL(src,base).searchParams.get("leitura")||"",/^pv2_[A-Za-z0-9_-]{43}$/);
   await info.locator('#close-info[aria-disabled="true"]').waitFor({timeout:10000});
   await info.locator("#back-info").click();
   await first.waitForFunction(()=>!document.getElementById("pv-information-dialog").open);
   assert.equal(await first.locator("#pv-brand-intro").evaluate(d=>d.open),true);
   // O botão físico/nativo do navegador também fecha a página de leitura.
   await first.locator("#pv-brand-info-link").click();
   await first.locator("#pv-information-dialog[open]").waitFor();
   await info.locator("#back-info").waitFor();
   await first.evaluate(()=>history.back());
   await first.waitForFunction(()=>!document.getElementById("pv-information-dialog").open,{timeout:10000});
   assert.equal(await first.locator("#pv-brand-intro").evaluate(d=>d.open),true);
   // Confirmar e ir para as especialidades, sem recarregar a autenticação.
   await first.locator("#pv-brand-info-link").click();
   await first.locator("#pv-information-dialog[open]").waitFor();
   await info.locator("#close-info").click({force:true});
   assert.match(await info.locator("#pv-awareness-feedback").textContent(),/confirme a leitura/i);
   await info.locator("#pv-awareness-check").check();
   assert.equal(await info.locator("#close-info").getAttribute("aria-disabled"),"false");
   await first.waitForFunction(()=>
     document.querySelector("#pv-brand-intro-back")?.getAttribute("aria-disabled")==="false");
   await info.locator("#close-info").click();
   await first.waitForFunction(()=>!document.getElementById("pv-information-dialog").open);
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator("#pv-brand-intro").evaluate(d=>d.open),false);
   assert.equal(await first.evaluate(()=>Boolean(window.__sdkOpened)),false);

   // Currículos: volta nativa e botão dentro da página restauram a sessão.
   await first.locator("#hub-professionals-link").click();
   await first.locator(".pv-curricula-dialog[open]").waitFor({timeout:10000});
   await first.frameLocator(".pv-curricula-dialog:not(.pv-appointments-panel-dialog) .pv-curricula-frame").locator("#pv-curricula-return").waitFor();
   await first.evaluate(()=>history.back());
   await first.waitForFunction(()=>!document.querySelector(".pv-curricula-dialog").open);
   await first.locator("#directory-dialog[open]").waitFor();
   assert.equal(await first.evaluate(()=>Boolean(window.__sdkOpened)),false);
   await first.locator("#hub-professionals-link").click();
   await first.locator(".pv-curricula-dialog[open]").waitFor();
   const curriculum=first.frameLocator(".pv-curricula-dialog:not(.pv-appointments-panel-dialog) .pv-curricula-frame");
   await curriculum.locator("#pv-curricula-return").click();
   await first.waitForFunction(()=>!document.querySelector(".pv-curricula-dialog").open);
   await first.locator("#directory-dialog[open]").waitFor();

   // Um link do provedor de currículos presente na camada PromoVie
   // deve abrir a cópia local branca, sem criar uma nova autenticação.
   await first.evaluate(()=>{
     const a=document.createElement("a");
     a.href="https://profissionais-telessaude.vercel.app/";
     a.id="pv-test-external-curricula";
     a.textContent="Teste de currículo do provedor";
     document.querySelector("#directory-dialog .hub-footer").append(a);
   });
   await first.locator("#pv-test-external-curricula").click();
   await first.locator(".pv-curricula-dialog:not(.pv-appointments-panel-dialog)[open]").waitFor({timeout:10000});
   const localCurricula=first.frameLocator(".pv-curricula-dialog:not(.pv-appointments-panel-dialog) .pv-curricula-frame");
   await localCurricula.locator("#pv-curricula-return").waitFor();
   const colors=await localCurricula.locator("body").evaluate(body=>({
     background:getComputedStyle(body).backgroundColor,
     theme:document.documentElement.getAttribute("data-theme")
   }));
   assert.deepEqual(colors,{background:"rgb(255, 255, 255)",theme:"light"});
   await localCurricula.locator("#pv-curricula-return").click();
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.evaluate(()=>Boolean(window.__sdkOpened)),false);

   // Da grade inicial, Voltar retorna à apresentação, não à tela de CPF.
   await first.evaluate(()=>history.back());
   await first.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
   assert.match(first.url(),/\/telessaude\/teste-aceite\/atendimento\//);
   await first.locator("#pv-brand-intro-back").click();
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   // Voltar duas vezes deve navegar grade -> apresentação -> grade,
   // sem redirecionar indevidamente à tela inicial de CPF.
   await first.evaluate(()=>history.back());
   await first.locator("#pv-brand-intro[open]").waitFor({timeout:10000});
   await first.evaluate(()=>history.back());
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   assert.match(first.url(),/\/telessaude\/teste-aceite\/atendimento\//);

   // Ao navegar para uma especialidade, Voltar restaura a grade anterior.
   await first.locator('button.hub-category[data-key="Psicologia"]').click();
   await first.locator("#hub-professionals:not([hidden])").waitFor();
   await first.evaluate(()=>history.back());
   await first.locator("#hub-categories:not([hidden])").waitFor({timeout:10000});
   await first.locator("#directory-dialog[open]").waitFor();

   // Agendamentos também se fecham com o histórico nativo.
   await first.locator("#hub-shortcut-appointments").click();
   await first.locator("#appointments-dialog[open]").waitFor();
   await first.evaluate(()=>history.back());
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator("#appointments-dialog").evaluate(d=>d.open),false);
   // Painel externo Meus Agendamentos: apresentação invertida para clara,
   // sem acesso às informações internas do iframe ou aos tokens Médiquo.
   await first.locator("#hub-shortcut-appointments").click();
   await first.locator("#appointments-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator("#appointments-my-panel").count(),0,
     "Sem o botão adicional de Meus Agendamentos");
   assert.equal((await first.locator('.agenda-modal-actions .agenda-modal-link').first().textContent()).trim(),"Agendar consulta");
   await first.evaluate(()=>{
     const link=document.createElement("a");
     link.href="https://painel-agendazap.vercel.app/";
     link.id="pv-test-remote-appointments";
     link.textContent="Teste automático do link do provedor";
     document.querySelector("#appointments-dialog .agenda-modal-actions").append(link);
   });
   await first.locator("#pv-test-remote-appointments").click();
   await first.locator(".pv-appointments-panel-dialog[open]").waitFor({timeout:10000});
   const myAppointmentsFrame=first.frameLocator(".pv-appointments-panel-dialog iframe");
   await myAppointmentsFrame.locator("#pv-appointments-external").waitFor({timeout:10000});
   const appointmentAppearance=await myAppointmentsFrame.locator("#pv-appointments-external").evaluate(frame=>({
     filter:getComputedStyle(frame).filter,
     background:getComputedStyle(document.body).backgroundColor
   }));
   assert.match(appointmentAppearance.filter,/invert\(1\)/);
   assert.equal(appointmentAppearance.background,"rgb(255, 255, 255)");
   // Somente o navegador automatizado inspeciona o frame remoto.
   await myAppointmentsFrame.frameLocator("#pv-appointments-external")
     .locator("#consultaForm").waitFor({timeout:15000});
   // Voltar explícito na página mantém o diálogo de origem.
   await myAppointmentsFrame.locator("#pv-appointments-back").click();
   await first.locator("#appointments-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator(".pv-appointments-panel-dialog").evaluate(d=>d.open),false);
   // Também funciona com botão Voltar nativo do navegador.
   await first.locator("#pv-test-remote-appointments").click();
   await first.locator(".pv-appointments-panel-dialog[open]").waitFor({timeout:10000});
   await first.evaluate(()=>history.back());
   await first.locator("#appointments-dialog[open]").waitFor({timeout:10000});
   assert.equal(await first.locator(".pv-appointments-panel-dialog").evaluate(d=>d.open),false);
   await first.locator("#appointments-specialties").click();
   await first.locator("#directory-dialog[open]").waitFor({timeout:10000});

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
