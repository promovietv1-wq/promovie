import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const read = path => readFile(new URL(path,import.meta.url),'utf8');

test('manifesto legado mantém identidade sem recomendar instalação', async()=>{
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

test('entrada preserva login e oferece um único Adicionar atalho ilustrado',async()=>{
  const html=await read('./index.html');
  assert.match(html,/rel="manifest" href="\/telesaude\/manifest\.webmanifest"/);
  assert.match(html,/src="\/telesaude\/pwa-install\.js/);
  for(const id of ['access-form','access-cpf','access-code','install-now',
    'pwa-install-actions','pwa-install-shortcut','pwa-help-dialog','pwa-help-device',
    'pwa-help-browser','pwa-help-steps','pwa-help-figure','pwa-help-photo']){
    assert.ok(html.includes('id="'+id+'"'),'Elemento ausente: '+id);
  }
  assert.doesNotMatch(html,/id="pwa-install-android"|id="pwa-install-apple"|id="pwa-install-desktop"/);
  assert.match(html,/type="button" id="pwa-install-shortcut"/);
  assert.match(html,/id="install-now" aria-label="Acessar" disabled/);
  assert.match(html,/window\.location\.assign\("\/telesaude\/atendimento\/"\)/);
});

test('guia oferece somente atalhos, sem instalar aplicativos',async()=>{
  const js=await read('./pwa-install.js');
  const html=await read('./index.html');
  const css=await read('./atalhos-agenda.css');
  assert.match(js,/beforeinstallprompt/);
  assert.match(js,/event\.preventDefault\(\)/);
  assert.doesNotMatch(js,/\.prompt\(\)|userChoice|installPrompt|nativeButton/);
  assert.doesNotMatch(html,/id="pwa-native-install"|Instalar agora neste aparelho/);
  assert.doesNotMatch(css,/\.pwa-native-install/);
  assert.match(js,/DESATIVE a opção Abrir como app web/);
  assert.match(js,/Criar atalho/);
  assert.match(js,/Google Chrome/);
  assert.match(js,/Adicionar à Tela de Início/);
  assert.match(js,/Adicionar à tela/);
  assert.match(js,/não/);
  assert.match(js,/data-pwa-close/);
  assert.doesNotMatch(js,/sessionStorage|localStorage|access_token|MediquoWidget|\/patients\/authenticate/);
  assert.doesNotMatch(js,/JSON\.stringify\(\{\s*cpf|MEDIQUO_V3_SDK_SECRET_KEY/);
});

test('agendamentos externos ficam isolados da Médiquo, sem mensagem repetida',async()=>{
  const html=await read('./atendimento/index.html');
  const script=await read('./agendamentos.js');
  const style=await read('./atalhos-agenda.css');
  assert.match(html,/id="appointments-trigger"/);
  assert.match(html,/id="appointments-dialog"/);
  assert.equal((html.match(/class="agenda-link-arrow"/g)||[]).length,2,"Os dois links devem ter ícones SVG");
  assert.doesNotMatch(html,/<span aria-hidden="true">↗<\/span>/,"Não usar setas emoji no celular");
  assert.match(style,/\.agenda-modal-link \.agenda-link-arrow/);
  assert.match(html,/href="https:\/\/tinyurl\.com\/agendamq"/);
  assert.match(html,/href="https:\/\/tinyurl\.com\/AgndrCon"/);
  assert.match(html,/target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/text:\{title:"Médicos e Especialistas"\}/);
  assert.match(html,/https:\/\/widget\.mediquo\.com\/js\/1\.0\.0\/mediquo\.js/);
  assert.match(script,/showModal/);
  assert.doesNotMatch(script,/MediquoWidget|accessToken|apiKey|sessionStorage|localStorage/);
  assert.match(style,/agenda-modal/);
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
