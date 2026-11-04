import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleV3} from './src/v3.mjs';

const origin='https://www.promovie.tv.br';
const cpf='52998224725'; // CPF sintético, nunca paciente real.
const env={
  ALLOWED_ORIGINS:origin,
  TELESAUDE_V3_ENABLED:'true',
  TELESAUDE_V3_WRITE_ENABLED:'false',
  WIDGET_ENVIRONMENT:'production',
  MEDIQUO_V3_WIDGET_API_KEY:'widget-publica-ficticia',
  MEDIQUO_V3_SDK_API_KEY:'sdk-api-ficticia',
  MEDIQUO_V3_SDK_SECRET_KEY:'sdk-segredo-ficticio',
  MEDIQUO_V3_ID_BASE_URL:'https://api-portal.mediquo.com.br',
  MEDIQUO_V3_ID_EMAIL:'teste@example.invalid',
  MEDIQUO_V3_ID_PASSWORD:'senha-id-ficticia',
  MEDIQUO_V3_CLIENT_ID:'9999',
  MEDIQUO_V3_PLAN:'345',
  MEDIQUO_V3_ORIGIN:'SDK',
  MEDIQUO_V3_BASE_URL:'https://sdk.mediquo.com/v1',
  MEDIQUO_V3_SDK_AUTH_MODE:'cpf',
  TELESAUDE_V3_TEST_PASSWORD:'senha-forte-ficticia-123456',
  TELESAUDE_V3_TEST_CPF:cpf,
  TELESAUDE_V3_SYNC_TOKEN:'token-de-testes-ficticio-com-32-caracteres'
};
let ipIndex=0;
async function call(route,opts={},e=env) {
  const headers=new Headers(opts.headers||{});
  headers.set('CF-Connecting-IP','198.51.100.'+(++ipIndex));
  return handleV3(new Request('https://backend.promovie.tv.br/api/mediquo/v3'+route,{...opts,headers}),e,{
    'Access-Control-Allow-Origin':origin
  });
}
function mockFetch(handler) {
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async(url,init)=>{
    const record={url:String(url),method:init?.method,headers:init?.headers,body:init?.body};
    calls.push(record);
    const result=await handler(record);
    return new Response(result.body===undefined?'':JSON.stringify(result.body),{
      status:result.status||200,
      headers:{'Content-Type':'application/json'}
    });
  };
  return {calls,restore(){globalThis.fetch=original;}};
}
function mockVendor({patientActive=true,authMode='cpf'}={}) {
  return mockFetch(async r=>{
    if(r.url.endsWith('/auth/login'))return {body:{token:'jwt-id-ficticio'}};
    if(r.url.includes('/patients?'))return {body:{content: [{
      documentNumber:cpf,active:patientActive,clientId:9999,planId:345,licenceId:'lic-ficticia'
    }]}};
    if(r.url.endsWith('/patients')&&r.method==='POST')
      return {body:{id:111,active:true,clientId:9999,planId:345}};
    if(r.url.endsWith('/patients/authenticate?code='+cpf))
      return {body:{access_token:'token-sessao-ficticio'}};
    if(r.url.endsWith('/patients/lic-ficticia/token'))
      return {body:{token:'token-licenca-ficticio'}};
    throw Error('Rota inesperada '+r.url+' '+authMode);
  });
}

test('desativado por padrão não expõe segredos nem autentica',async()=>{
  assert.equal((await (await call('/health',{},{})).json()).status,'aguardando-configuracao');
  assert.equal((await call('/config',{},{})).status,503);
  assert.equal((await call('/session',{method:'POST',body:'{}'},{})).status,503);
  const notReady={...env,TELESAUDE_V3_ENABLED:'false'};
  assert.equal((await call('/config',{},notReady)).status,503);
  assert.equal((await call('/config',{}, {...env,WIDGET_ENVIRONMENT:'sandbox'})).status,503);
  assert.equal((await call('/config',{}, {...env,MEDIQUO_V3_CLIENT_ID:''})).status,503);
  assert.equal((await call('/config',{}, {...env,MEDIQUO_V3_PLAN:'219'})).status,503);
  assert.equal((await call('/config',{}, {...env,MEDIQUO_V3_ID_BASE_URL:'https://evil.example'})).status,503);
});
test('configuração pública só retorna API key do Widget e environment production',async()=>{
  const r=await call('/config');
  assert.equal(r.status,200);
  const data=await r.json();
  assert.deepEqual(data,{apiKey:env.MEDIQUO_V3_WIDGET_API_KEY,environment:'production'});
  const serialized=JSON.stringify(data);
  for(const forbidden of [env.MEDIQUO_V3_SDK_API_KEY,env.MEDIQUO_V3_SDK_SECRET_KEY,env.MEDIQUO_V3_ID_PASSWORD])
    assert.equal(serialized.includes(forbidden),false);
});
test('sem senha correta ou CPF autorizado não chama API externa',async()=>{
  const original=globalThis.fetch;let external=0;
  globalThis.fetch=async()=>{external++;throw Error('não deveria consultar Médiquo');};
  try{
    assert.equal((await call('/session',{method:'POST',body:JSON.stringify({document:cpf})})).status,401);
    assert.equal((await call('/session',{method:'POST',body:JSON.stringify({document:'12345678901',testPassword:env.TELESAUDE_V3_TEST_PASSWORD})})).status,401);
    assert.equal(external,0);
  }finally{globalThis.fetch=original;}
});
test('cadastro de teste exige duas autorizações independentes',async()=>{
  const m=mockVendor();
  try{
    const payload=JSON.stringify({patients:[{document:cpf}]});
    const authorized={method:'POST',headers:{Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN},body:payload};
    assert.equal((await call('/patients/sync',authorized)).status,503);
    assert.equal((await call('/patients/sync',{method:'POST',body:payload},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'})).status,401);
    assert.equal((await call('/patients/sync',{...authorized,body:JSON.stringify({patients:[{document:'12345678901'}]})},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'})).status,403);
    assert.equal(m.calls.length,0);
  }finally{m.restore();}
});
test('cadastro fictício usa API ID POST /patients com clientId, planId, origin',async()=>{
  const m=mockVendor();
  try{
    const r=await call('/patients/sync',{method:'POST',headers:{
      Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN
    },body:JSON.stringify({patients:[{document:cpf}]})},{...env,TELESAUDE_V3_WRITE_ENABLED:'true'});
    assert.equal(r.status,200);
    assert.deepEqual((await r.json()),{ok:true,enviados:1});
    assert.equal(m.calls.length,2);
    assert.equal(m.calls[0].url,'https://api-portal.mediquo.com.br/auth/login');
    assert.equal(m.calls[1].url,'https://api-portal.mediquo.com.br/patients');
    assert.equal(m.calls[1].method,'POST');
    assert.deepEqual(JSON.parse(m.calls[1].body),{
      documentNumber:cpf,name:'Paciente Homologacao',clientId:9999,planId:345,origin:'SDK'
    });
    assert.equal(m.calls[1].headers.Authorization,'Bearer jwt-id-ficticio');
  }finally{m.restore();}
});
test('somente paciente ID ativo recebe token SDK no modo CPF, sem enviar senha privada ao navegador',async()=>{
  const m=mockVendor();
  try{
    const r=await call('/session',{method:'POST',body:JSON.stringify({document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(r.status,200);
    assert.deepEqual(await r.json(),{access_token:'token-sessao-ficticio'});
    assert.equal(m.calls.length,3);
    assert.equal(m.calls[1].method,'GET');
    assert.equal(m.calls[2].url,'https://sdk.mediquo.com/v1/patients/authenticate?code='+cpf);
    assert.equal(m.calls[2].headers['X-API-Key'],env.MEDIQUO_V3_SDK_API_KEY);
    assert.equal(m.calls[2].headers['X-Secret-Key'],env.MEDIQUO_V3_SDK_SECRET_KEY);
    assert.equal(m.calls[2].body,undefined);
  }finally{m.restore();}
});
test('paciente inativo é recusado antes de chamar API SDK',async()=>{
  const m=mockVendor({patientActive:false});
  try {
    const r=await call('/session',{method:'POST',body:JSON.stringify({document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(r.status,403);
    assert.equal(m.calls.length,2);
  }finally{m.restore();}
});
test('modo licence aceita endpoint da documentação SDK API, mediante licenceId',async()=>{
  const m=mockVendor({authMode:'licence'});
  try{
    const r=await call('/session',{method:'POST',body:JSON.stringify({document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD})},{...env,MEDIQUO_V3_SDK_AUTH_MODE:'licence'});
    assert.equal(r.status,200);
    assert.equal((await r.json()).access_token,'token-licenca-ficticio');
    assert.equal(m.calls[2].url,'https://sdk.mediquo.com/v1/patients/lic-ficticia/token');
  }finally{m.restore();}
});
test('falha externa não retorna credenciais privadas na resposta',async()=>{
  const m=mockFetch(async()=>({status:401,body:{error:'chaves'}}));
  try{
    const r=await call('/session',{method:'POST',body:JSON.stringify({document:cpf,testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(r.status,403);
    const b=JSON.stringify(await r.json());
    assert.equal(b.includes(env.MEDIQUO_V3_ID_PASSWORD),false);
  }finally{m.restore();}
});
test('pagina oficial ainda usa layout de 8 serviços e backend próprio',async()=>{
  const html=await readFile(new URL('../telesaude/index.html',import.meta.url),'utf8');
  assert.match(html,/https:\/\/backend\.promovie\.tv\.br/);
  assert.match(html,/senha privada (?:da conta )?de homologação/i);
  assert.match(html,/<title>PromoVie \| TeleSaúde<\/title>/);
  assert.doesNotMatch(html,/MEDIQUO_V3_SDK_SECRET_KEY\s*=/);
});
