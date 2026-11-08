import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
const first='A'.repeat(20),second='B'.repeat(20),origin='http://127.0.0.1:8769';
const browser=await chromium.launch({headless:true});
await mkdir('/tmp/pv-space-shots',{recursive:true});
async function run(width){
  let vault=null;
  const docs=new Map(),errors=[];
  const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true,reducedMotion:'reduce'});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://backend.promovie.tv.br/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname.split('/space/v1')[1];
    const method=request.method();
    const headers={'Access-Control-Allow-Origin':origin,
      'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type,Authorization'};
    if(method==='OPTIONS')return route.fulfill({status:204,headers});
    let status=200,body={ok:true};
    if(path==='/health')body={disponivel:true};
    else if(path==='/session'&&method==='POST')body={token:'session-fixture'};
    else if(path==='/vault'&&method==='GET')body={revision:vault?.revision||0,record:vault};
    else if(path==='/vault'&&method==='PUT'){
      const data=request.postDataJSON();
      assert.equal(data.revision,vault?.revision||0);
      if(!vault)assert.equal(data.consent,true);
      if(vault&&data.salt!==vault.salt)assert.equal(data.previousSalt,vault.salt);
      assert.ok(typeof data.ciphertext==='string'&&data.ciphertext.length>20);
      vault={revision:data.revision+1,salt:data.salt,iv:data.iv,ciphertext:data.ciphertext};
      body={revision:vault.revision};
    }
    else if(path==='/documents'&&method==='POST'){
      const data=request.postDataJSON();docs.set(data.id,data.ciphertext);
      status=201;body={id:data.id};
    }
    else if(path?.startsWith('/documents/')&&method==='GET'){
      const id=path.split('/').at(-1);
      if(docs.has(id))body={ciphertext:docs.get(id)};
      else{status=404;body={error:'Não encontrado'};}
    }
    else if(path==='/logout'&&method==='POST')body={ok:true};
    else{status=404;body={error:'Rota de simulação ausente'};}
    return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)});
  });
  async function login(code,expected){
    await page.locator('#cpf').fill('123.456.789-09');
    await page.locator('#access-code').fill(code);
    await page.locator('#login-form button').click();
    await page.locator('#'+expected+'-view').waitFor({state:'visible',timeout:25000});
  }
  async function logout(){
    await page.locator('#logout').click();
    await page.locator('#login-view').waitFor({state:'visible'});
  }
  try{
    await page.goto(origin+'/telesaude/meu-espaco/',{waitUntil:'load'});
    await login(first,'unlock');
    assert.equal(await page.locator('#legacy-wrap').isVisible(),false);
    assert.equal(await page.locator('#unlock-title').innerText(),'Meu Espaço de Saúde');
    assert.equal(await page.locator('#unlock-submit').innerText(),'Ativar meu espaço');
    assert.match(await page.locator('.warning').innerText(),/informar o anterior uma vez/);
    assert.equal(await page.locator('#unlock-back').count(),0);
    await page.locator('#privacy-consent').check();
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.match(vault.salt,/^c2_/);
    await page.locator('#allergies').fill('Observação de teste');
    await page.locator('#save-all').click();
    const pdf=Buffer.from('%PDF-1.4\n%%EOF\n');
    await page.locator('#file-input').setInputFiles({name:'resultado.pdf',mimeType:'application/pdf',buffer:pdf});
    await page.locator('#upload-file').click();
    await page.locator('#documents-list li').waitFor();
    await logout();
    await login(first,'workspace');
    assert.equal(await page.locator('#allergies').inputValue(),'Observação de teste');
    await logout();
    await login(second,'unlock');
    assert.match(await page.locator('#old-credential-label').innerText(),/Código anterior/);
    await page.locator('#vault-passphrase').fill(first);
    await page.locator('#unlock-submit').click();
    await page.locator('#workspace-view').waitFor({state:'visible',timeout:25000});
    assert.equal(await page.locator('#allergies').inputValue(),'Observação de teste');
    await logout();
    await login(second,'workspace');
    const downloading=page.waitForEvent('download',{timeout:15000});
    await page.locator('#documents-list button').first().click();
    const downloaded=await downloading;
    assert.deepEqual(await readFile(await downloaded.path()),pdf,'Documento preservado após rotação');
    assert.deepEqual(errors,[]);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.screenshot({path:'/tmp/pv-space-shots/single-code-'+width+'.png',fullPage:true});
    console.log('Código único e migração aprovados:',width);
  }finally{await page.close();}
}

async function testSingleSignOn(){
  let vault=null,profileToCheck="Anotação de teste sem dados reais";
  const errors=[],context=await browser.newContext({
    viewport:{width:390,height:820},permissions:["clipboard-read","clipboard-write"]
  });
  context.on("page",page=>page.on("pageerror",err=>errors.push(err.message)));
  await context.route("https://widget.mediquo.com/**",route=>route.fulfill({
    status:200,contentType:"application/javascript",
    body:"window.MediquoWidget={init:()=>{window.__pvInit=(window.__pvInit||0)+1},open:()=>{window.__pvOpen=(window.__pvOpen||0)+1}};"
  }));
  await context.route("https://backend.promovie.tv.br/**",async route=>{
    const request=route.request(),url=new URL(request.url()),method=request.method();
    const path=url.pathname,headers={
      "Access-Control-Allow-Origin":origin,
      "Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers":"Authorization,Content-Type",
      "Cache-Control":"no-store"
    };
    if(method==="OPTIONS")return route.fulfill({status:204,headers});
    let body={},status=200;
    if(path==="/api/promovie/access/v1/health")body={disponivel:true};
    else if(path==="/api/promovie/access/v1/session")body={
      access_token:"sdk-session-test",apiKey:"mock-sdk-api-key",environment:"production"
    };
    else if(path==="/api/promovie/space/v1/health")body={disponivel:true};
    else if(path==="/api/promovie/space/v1/session")body={token:"S".repeat(43),expira_em_segundos:1800};
    else if(path==="/api/promovie/space/v1/vault"&&method==="GET"){
      // Mantém a etapa de carregamento perceptível para detectar flashes de login.
      await new Promise(resolve=>setTimeout(resolve,450));
      assert.equal(request.headers().authorization,"Bearer "+"S".repeat(43));
      body={revision:vault?.revision||0,record:vault};
    }else if(path==="/api/promovie/space/v1/vault"&&method==="PUT"){
      const req=request.postDataJSON();
      assert.equal(req.revision,vault?.revision||0);
      if(!vault)assert.equal(req.consent,true);
      vault={revision:req.revision+1,salt:req.salt,iv:req.iv,ciphertext:req.ciphertext};
      body={revision:vault.revision};
    }else if(path==="/api/promovie/space/v1/logout")body={ok:true};
    else{status=404;body={error:"Rota de teste não simulada."};}
    await route.fulfill({status,headers,contentType:"application/json",body:JSON.stringify(body)});
  });
  async function openFromSameLogin(code,width=390){
    const tab=await context.newPage();
    await tab.setViewportSize({width,height:900});
    await tab.goto(origin+"/telesaude/",{waitUntil:"load"});
    await tab.waitForFunction(()=>!document.getElementById("install-now").disabled);
    await tab.locator("#access-cpf").fill("123.456.789-09");
    await tab.locator("#access-code").fill(code);
    await tab.locator("#install-now").click();
    await tab.waitForURL("**/telesaude/atendimento/",{timeout:15000});
    await tab.locator(".space-entry").waitFor({state:"visible",timeout:15000});
    assert.equal(await tab.evaluate(()=>window.__pvInit),1);
    assert.equal(await tab.evaluate(()=>window.__pvOpen),1);
    assert.equal(await tab.evaluate(()=>sessionStorage.getItem("promovie:mediquo:handoff:v1")),null);
    const opening=tab.waitForEvent("popup",{timeout:15000});
    await tab.locator(".space-entry").click();
    const space=await opening;
    await space.waitForLoadState("load");
    assert.equal(await space.locator("#login-view").isVisible(),false,
      "Login da área pessoal não pode piscar antes do acesso compartilhado");
    assert.equal(await space.locator("#loading-view").isVisible(),true,
      "Deve mostrar apenas carregamento discreto durante o SSO");
    assert.equal(new URL(space.url()).hash,"");
    assert.ok(!space.url().includes("sdk-session-test"));
    assert.equal(await space.evaluate(()=>window.opener?.location.pathname),"/telesaude/atendimento/",
      "Espaço precisa de uma referência à aba da consulta para retornar sem recarregar");
    return {tab,space};
  }
  try{
    const firstOpen=await openFromSameLogin(first,1440);
    await firstOpen.space.locator("#unlock-view").waitFor({state:"visible",timeout:20000});
    assert.equal(await firstOpen.space.locator("#login-view").isVisible(),false,
      "A nova aba não deve pedir novamente CPF/código");
    await firstOpen.space.locator("#privacy-consent").check();
    await firstOpen.space.locator("#unlock-submit").click();
    await firstOpen.space.locator("#workspace-view").waitFor({state:"visible",timeout:20000});
    await firstOpen.space.locator("#allergies").fill(profileToCheck);
    await firstOpen.space.locator("#save-all").click();
    await firstOpen.space.locator("#make-summary").click();
    await firstOpen.space.locator("#copy-summary").click();
    const copied=await firstOpen.space.evaluate(()=>navigator.clipboard.readText());
    assert.ok(copied.includes(profileToCheck),"Resumo pode ser copiado para colar no atendimento");
    assert.equal(await firstOpen.space.locator("#attendance-guidance").count(),0);
    assert.equal(await firstOpen.space.locator("#return-from-summary").count(),0);
    assert.equal(await firstOpen.space.locator("#focus-attendance").count(),0);
    await firstOpen.space.locator("#close-summary").click();
    await firstOpen.tab.bringToFront();
    assert.equal(await firstOpen.tab.evaluate(()=>window.__pvInit),1,
      "Alternar entre abas não reinicializa o SDK");
    assert.equal(new URL(firstOpen.tab.url()).pathname,"/telesaude/atendimento/");
    await firstOpen.space.close();
    // Simular um PWA móvel que não permite abrir outra janela (ex.: iPhone).
    // O clique não pode substituir o documento da consulta e derrubar o SDK.
    await firstOpen.tab.evaluate(()=>{
      window.open=()=>null;
    });
    await firstOpen.tab.locator(".space-entry").click();
    assert.equal(new URL(firstOpen.tab.url()).pathname,"/telesaude/atendimento/",
      "Um bloqueio de pop-up não pode fechar a consulta");
    assert.equal(await firstOpen.tab.locator("#space-open-help").isVisible(),true);
    assert.equal(await firstOpen.tab.evaluate(()=>window.__pvInit),1,
      "Falha de segunda janela não deve recarregar Médiquo");
    await firstOpen.tab.close();

    const secondOpen=await openFromSameLogin(first,1440);
    await secondOpen.space.locator("#workspace-view").waitFor({state:"visible",timeout:20000});
    assert.equal(await secondOpen.space.locator("#attendance-guidance").count(),0);
    await secondOpen.tab.bringToFront();
    assert.equal(await secondOpen.space.locator("#allergies").inputValue(),profileToCheck,
      "O cofre pode ser reaberto sem novo login e preserva a criptografia");
    await secondOpen.space.close();await secondOpen.tab.close();

    // Simular um atalho de tela inicial / PWA em modo standalone.
    // O Meu Espaço deve abrir DENTRO da página, sem window.open.
    const installed=await context.newPage();
    await installed.addInitScript(()=>{
      const nativeMatchMedia=window.matchMedia.bind(window);
      window.matchMedia=function(query){
        if(query==="(display-mode: standalone)")return {
          matches:true,media:query,
          addListener(){},removeListener(){},
          addEventListener(){},removeEventListener(){}
        };
        return nativeMatchMedia(query);
      };
    });
    await installed.setViewportSize({width:390,height:850});
    await installed.goto(origin+"/telesaude/",{waitUntil:"load"});
    await installed.waitForFunction(()=>!document.getElementById("install-now").disabled);
    await installed.locator("#access-cpf").fill("123.456.789-09");
    await installed.locator("#access-code").fill(first);
    await installed.locator("#install-now").click();
    await installed.waitForURL("**/telesaude/atendimento/",{timeout:15000});
    await installed.locator(".space-entry").waitFor({state:"visible",timeout:15000});
    let popups=0;
    installed.on("popup",()=>popups++);
    await installed.locator(".space-entry").click();
    await installed.locator("#space-embedded").waitFor({state:"visible",timeout:15000});
    const embedded=installed.frameLocator("#space-embedded-frame");
    await embedded.locator("#loading-view").waitFor({state:"visible",timeout:12000});
    assert.equal(await embedded.locator("#login-view").isVisible(),false,
      "PWA não deve mostrar o formulário de login durante a abertura");
    await embedded.locator("#workspace-view").waitFor({state:"visible",timeout:20000});
    assert.equal(await embedded.locator("#loading-view").isVisible(),false);
    assert.equal(await embedded.locator("#login-view").isVisible(),false);
    assert.equal(await embedded.locator("#allergies").inputValue(),profileToCheck);
    assert.equal(await embedded.locator("#attendance-guidance").count(),0);
    assert.equal(await installed.locator("#space-embedded-return").count(),0);
    assert.equal(popups,0,"App instalado deve manter Meu Espaço na mesma janela");
    assert.equal(await installed.evaluate(()=>window.__pvInit),1);
    await installed.evaluate(()=>history.back());
    await installed.locator("#space-embedded").waitFor({state:"hidden",timeout:5000});
    assert.equal(new URL(installed.url()).pathname,"/telesaude/atendimento/");
    assert.equal(await installed.evaluate(()=>window.__pvOpen),1,
      "O retorno no PWA não deve reiniciar o atendimento");
    await installed.locator(".space-entry").click();
    await installed.locator("#space-embedded").waitFor({state:"visible",timeout:5000});
    assert.equal(await embedded.locator("#allergies").inputValue(),profileToCheck,
      "Reabrir no PWA mantém o cofre carregado em memória");
    await embedded.locator("#make-summary").click();
    await embedded.locator("#copy-summary").click();
    await embedded.locator("#close-summary").click();
    await installed.evaluate(()=>history.back());
    await installed.locator("#space-embedded").waitFor({state:"hidden",timeout:5000});
    assert.equal(await installed.evaluate(()=>window.__pvInit),1);
    await installed.close();

    assert.deepEqual(errors,[],"Sem erros JavaScript na alternância do atendimento");
    console.log("Integração: navegador, mobile, desktop e PWA sem reiniciar a consulta.");
  }finally{await context.close();}
}

try{for(const width of [390,1440])await run(width);await testSingleSignOn();}
finally{await browser.close();}
