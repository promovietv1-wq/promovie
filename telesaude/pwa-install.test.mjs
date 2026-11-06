import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const read = path => readFile(new URL(path,import.meta.url),'utf8');

test('manifesto instala a TeleSaúde PromoVie isolada e com identidade visual da marca', async()=>{
  const m=JSON.parse(await read('./manifest.webmanifest'));
  assert.equal(m.name,'TeleSaúde PromoVie');
  assert.equal(m.start_url,'/telesaude/');
  assert.equal(m.scope,'/telesaude/');
  assert.equal(m.id,'/telesaude/');
  assert.equal(m.display,'standalone');
  assert.equal(m.lang,'pt-BR');
  assert.ok(m.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(m.icons.some(icon=>icon.sizes==='512x512'));
  assert.ok(m.icons.every(icon=>icon.src.startsWith('/app/icons/')));
});

test('a página mantém o login e apresenta opções separadas para celular e desktop',async()=>{
  const html=await read('./index.html');
  assert.match(html,/rel="manifest" href="\/telesaude\/manifest\.webmanifest"/);
  assert.match(html,/src="\/telesaude\/pwa-install\.js/);
  for(const id of ['access-form','access-cpf','access-code','install-now',
    'pwa-install-actions','pwa-install-android','pwa-install-apple',
    'pwa-install-desktop','pwa-help-dialog','pwa-help-steps']){
    assert.ok(html.includes('id="'+id+'"'),'Elemento ausente: '+id);
  }
  assert.match(html,/data-pwa-device="mobile"/);
  assert.match(html,/data-pwa-device="desktop"/);
  assert.match(html,/pwa-install-mobile\{display:grid/);
  assert.match(html,/pwa-install-desktop\{display:flex/);
  assert.match(html,/type="button" id="pwa-install-android"/);
  assert.match(html,/type="button" id="pwa-install-apple"/);
  assert.match(html,/type="button" id="pwa-install-desktop"/);
  assert.match(html,/id="install-now" aria-label="Acessar" disabled/);
  assert.match(html,/window\.location\.assign\("\/telesaude\/atendimento\/"\)/);
});

test('instalação depende do navegador, e iPhone/Mac recebem passos reais',async()=>{
  const js=await read('./pwa-install.js');
  assert.match(js,/beforeinstallprompt/);
  assert.match(js,/\.prompt\(\)/);
  assert.match(js,/appinstalled/);
  assert.match(js,/Adicionar à Tela de Início/);
  assert.match(js,/Adicionar ao Dock/);
  assert.match(js,/barra de tarefas/);
  assert.match(js,/data-pwa-close/);
  assert.doesNotMatch(js,/sessionStorage|localStorage|access_token|MediquoWidget|\/patients\/authenticate/);
  assert.doesNotMatch(js,/JSON\.stringify\(\{\s*cpf|MEDIQUO_V3_SDK_SECRET_KEY/);
});

test('service worker acessa somente entrada pública por rede, nunca atendimento ou API',async()=>{
  const source=await read('./sw.js');
  assert.doesNotMatch(source,/caches\.|cache\.put|sessionStorage|localStorage|MediquoWidget|access_token/);
  const handlers=new Map();
  let calls=0;
  const self={
    location:{origin:'https://www.promovie.tv.br'},
    addEventListener:(name,fn)=>handlers.set(name,fn),
    skipWaiting:()=>{},
    clients:{claim:()=>Promise.resolve()}
  };
  runInNewContext(source,{self,URL,fetch:()=>{calls++;return Promise.resolve({ok:true});}},{timeout:1000});
  const handle=handlers.get('fetch');
  assert.equal(typeof handle,'function');
  const simulate=(url,mode='navigate',method='GET')=>{
    let intercepted=false;
    handle({request:{url,mode,method},respondWith(p){intercepted=true;void p;}});
    return intercepted;
  };
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/'),true);
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/index.html'),true);
  assert.equal(calls,2);
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/atendimento/'),false);
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/gestao/'),false);
  assert.equal(simulate('https://backend.promovie.tv.br/api/promovie/access/v1/session'),false);
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/','navigate','POST'),false);
  assert.equal(simulate('https://www.promovie.tv.br/telesaude/','cors','GET'),false);
  assert.equal(calls,2);
});
