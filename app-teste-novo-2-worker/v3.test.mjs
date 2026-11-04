import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleV3} from './src/v3.mjs';

const origin='https://www.promovie.tv.br';
const cpf='52998224725'; // Numero ficticio usado apenas nos testes locais.
const env={
  ALLOWED_ORIGINS:origin,TELESAUDE_V3_ENABLED:'true',TELESAUDE_V3_WRITE_ENABLED:'false',
  WIDGET_ENVIRONMENT:'production',
  MEDIQUO_V3_WIDGET_API_KEY:'api-key-publica-ficticia',
  MEDIQUO_V3_SDK_SECRET_KEY:'segredo-sdk-ficticio',
  MEDIQUO_V3_PLAN:'345',
  MEDIQUO_V3_BASE_URL:'https://sdk.mediquo.com/v1',
  TELESAUDE_V3_TEST_PASSWORD:'senha-testes-ficticia-123456',
  TELESAUDE_V3_TEST_CPF:cpf,
  TELESAUDE_V3_SYNC_TOKEN:'token-ficticio-de-sincronizacao-123456'
};
let counter=0;
async function call(path,opts={},e=env){
  const headers=new Headers(opts.headers||{});
  headers.set('CF-Connecting-IP','192.0.2.'+(++counter));
  return handleV3(new Request('https://backend.promovie.tv.br/api/mediquo/v3'+path,{...opts,headers}),e,{'Access-Control-Allow-Origin':origin});
}
function mockVendor(options={}){
  const old=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,init)=>{
    const u=String(url),r={url:u,method:init?.method,headers:init?.headers,body:init?.body};
    calls.push(r);
    let data;
    if(u.endsWith('/patients')&&init.method==='PUT'){
      data={};return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
    }
    if(u.endsWith('/patients/'+cpf)){
      if(options.missing)return new Response(JSON.stringify({error:'Not found'}),{status:404,headers:{'Content-Type':'application/json'}});
      data={
      data:{code:cpf,plan:options.plan??'345',
      ...(options.inactive?{unsubscribed_at:'2026-01-01'}:{})}
      };
    }
    else if(u.includes('/patients/authenticate?code='))data={access_token:'sessao-ficticia'};
    else throw Error('Endpoint inesperado: '+u);
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  return {calls,restore(){globalThis.fetch=old;}};
}
test('desativado por padrão, sem segredo ou com ambiente incorreto nunca autentica',async()=>{
  assert.equal((await (await call('/health',{},{})).json()).status,'aguardando-configuracao');
  assert.equal((await call('/config',{},{})).status,503);
  assert.equal((await call('/session',{method:'POST',body:'{}'},{})).status,503);
  for(const bad of [
    {TELESAUDE_V3_ENABLED:'false'},
    {WIDGET_ENVIRONMENT:'sandbox'},
    {MEDIQUO_V3_SDK_SECRET_KEY:''},
    {MEDIQUO_V3_WIDGET_API_KEY:''},
    {MEDIQUO_V3_PLAN:'219'},
    {MEDIQUO_V3_BASE_URL:'https://evil.example/v1'}
  ])assert.equal((await call('/config',{}, {...env,...bad})).status,503);
});
test('config devolve apenas a chave do Widget; segredo nunca é exposto',async()=>{
  const r=await call('/config');assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data,{apiKey:env.MEDIQUO_V3_WIDGET_API_KEY,environment:'production'});
  assert.equal(JSON.stringify(data).includes(env.MEDIQUO_V3_SDK_SECRET_KEY),false);
});
test('CPF sozinho ou senha inválida são bloqueados antes da consulta SDK',async()=>{
  const original=globalThis.fetch;let external=0;
  globalThis.fetch=async()=>{external++;throw Error('Chamada indevida');};
  try{
    const a=await call('/session',{method:'POST',body:JSON.stringify({document:cpf})});
    const b=await call('/session',{method:'POST',body:JSON.stringify({document:'12345678901',
      testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(a.status,401);assert.equal(b.status,400);assert.equal(external,0);
  }finally{globalThis.fetch=original;}
});
test('sincronizacao exige habilitacao de escrita e token privado, aceitando apenas CPF ficticio',async()=>{
  const m=mockVendor();
  try{
    const body=JSON.stringify({patients:[{document:cpf}]});
    const authorized={method:'POST',headers:{Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN},body};
    assert.equal((await call('/patients/sync',authorized)).status,503);
    assert.equal((await call('/patients/sync',{method:'POST',body},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'})).status,401);
    assert.equal((await call('/patients/sync',{
      ...authorized,body:JSON.stringify({patients:[{document:'12345678901'}]})
    },{...env,TELESAUDE_V3_WRITE_ENABLED:'true'})).status,403);
    assert.equal(m.calls.length,0);
  }finally{m.restore();}
});
test('kit final: PUT /patients SDK, plano 345 e dois headers de autenticação',async()=>{
  const m=mockVendor();
  try{
    const r=await call('/patients/sync',{
      method:'POST',headers:{Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN},
      body:JSON.stringify({patients:[{document:cpf,name:'Marco Polese'}]})
    },{...env,TELESAUDE_V3_WRITE_ENABLED:'true'});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,enviados:1});
    assert.equal(m.calls.length,1);
    assert.equal(m.calls[0].url,'https://sdk.mediquo.com/v1/patients');
    assert.equal(m.calls[0].method,'PUT');
    assert.equal(m.calls[0].headers['X-API-Key'],env.MEDIQUO_V3_WIDGET_API_KEY);
    assert.equal(m.calls[0].headers['X-Secret-Key'],env.MEDIQUO_V3_SDK_SECRET_KEY);
    const body=JSON.parse(m.calls[0].body);
    assert.deepEqual(body,{patients:[{code:cpf,tax_id:cpf,plan:'345',
      first_name:'Marco',last_name:'Polese',locale:'pt'}]});
    assert.equal(JSON.stringify(body).includes('clientId'),false);
  }finally{m.restore();}
});
test('paciente ativo retorna access_token com fluxo do pacote do Pedro',async()=>{
  const m=mockVendor();
  try{
    const r=await call('/session',{method:'POST',body:JSON.stringify({
      document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD
    })});
    assert.equal(r.status,200);assert.deepEqual(await r.json(),{access_token:'sessao-ficticia'});
    assert.deepEqual(m.calls.map(x=>[x.method,x.url]),[
      ['GET','https://sdk.mediquo.com/v1/patients/'+cpf],
      ['POST','https://sdk.mediquo.com/v1/patients/authenticate?code='+cpf]
    ]);
    assert.equal(m.calls[1].body,undefined);
    assert.equal(m.calls[1].headers['X-API-Key'],env.MEDIQUO_V3_WIDGET_API_KEY);
    assert.equal(m.calls[1].headers['X-Secret-Key'],env.MEDIQUO_V3_SDK_SECRET_KEY);
  }finally{m.restore();}
});
test('plano diferente ou paciente inativo sao bloqueados sem emitir token',async()=>{
  for(const options of [{plan:'219'},{inactive:true}]){
    const m=mockVendor(options);
    try{
      const r=await call('/session',{method:'POST',body:JSON.stringify({
        document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD
      })});
      assert.equal(r.status,403);assert.equal(m.calls.length,1);
    }finally{m.restore();}
  }
});
test('pagina oficial preserva a aparencia, oito servicos e backend correto',async()=>{
  const html=await readFile(new URL('../telesaude/index.html',import.meta.url),'utf8');
  assert.match(html,/<title>PromoVie \| TeleSaúde<\/title>/);
  assert.match(html,/https:\/\/backend\.promovie\.tv\.br/);
  assert.match(html,/senha privada (?:da conta )?de homologação/i);
  assert.equal((html.match(/class="chat-row"/g)||[]).length,8);
  assert.doesNotMatch(html,/MEDIQUO_V3_SDK_SECRET_KEY\s*=/);
});

test('cadastro individual é bloqueado sem flag, sem senha ou com CPF diferente',async()=>{
  const m=mockVendor();
  try{
    const body=JSON.stringify({document:cpf,name:'Marco Polese',
      testPassword:env.TELESAUDE_V3_TEST_PASSWORD});
    assert.equal((await call('/self-enroll',{method:'POST',body})).status,503);
    const e={...env,TELESAUDE_V3_WRITE_ENABLED:'true'};
    assert.equal((await call('/self-enroll',{method:'POST',body:JSON.stringify({
      document:cpf,name:'Marco Polese',testPassword:'senha-incorreta'})},e)).status,401);
    assert.equal((await call('/self-enroll',{method:'POST',body:JSON.stringify({
      document:'11111111111',name:'Marco Polese',testPassword:env.TELESAUDE_V3_TEST_PASSWORD})},e)).status,400);
    assert.equal(m.calls.length,0);
  }finally{m.restore();}
});
test('cadastro individual cria um paciente real somente quando CPF e senha coincidem',async()=>{
  const m=mockVendor({missing:true});
  try{
    const r=await call('/self-enroll',{method:'POST',body:JSON.stringify({
      document:cpf,name:'Marco Aurélio Polese',
      testPassword:env.TELESAUDE_V3_TEST_PASSWORD
    })},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'});
    assert.equal(r.status,202);assert.equal((await r.json()).status,'cadastro_enviado');
    assert.equal(m.calls.length,2);
    assert.equal(m.calls[0].method,'GET');
    assert.equal(m.calls[1].method,'PUT');
    assert.deepEqual(JSON.parse(m.calls[1].body),{patients:[{
      code:cpf,tax_id:cpf,first_name:'Marco',last_name:'Aurélio Polese',plan:'345',locale:'pt'
    }]});
  }finally{m.restore();}
});
test('cadastro individual não sobrescreve pessoa já cadastrada',async()=>{
  const m=mockVendor();
  try{
    const r=await call('/self-enroll',{method:'POST',body:JSON.stringify({
      document:cpf,name:'Marco Polese',testPassword:env.TELESAUDE_V3_TEST_PASSWORD
    })},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'});
    assert.equal((await r.json()).status,'ja_cadastrado');
    assert.equal(m.calls.length,1);
  }finally{m.restore();}
});
