import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleV3 } from './src/v3.mjs';

const origin='https://www.promovie.tv.br';
const env={
  ALLOWED_ORIGINS:origin,
  TELESAUDE_V3_ENABLED:'true',
  WIDGET_ENVIRONMENT:'sandbox',
  MEDIQUO_V3_API_KEY:'chave-publica-ficticia',
  MEDIQUO_V3_SECRET_KEY:'secret-ficticia',
  MEDIQUO_V3_PLAN:'plano-teste',
  MEDIQUO_V3_BASE_URL:'https://sandbox.example/v1',
  TELESAUDE_V3_TEST_PASSWORD:'senha-somente-teste-123',
  TELESAUDE_V3_TEST_CPF:'52998224725',
  TELESAUDE_V3_SYNC_TOKEN:'token-sincronizacao-somente-teste-2026'
};
async function call(path, options={}, e=env) {
  return handleV3(new Request('https://backend.promovie.tv.br/api/mediquo/v3'+path,options),e,{'Access-Control-Allow-Origin':origin});
}

test('sem configuração ou em produção, não emite sessão nem credenciais',async()=>{
  const health=await call('/health',{},{});
  assert.equal((await health.json()).status,'aguardando-configuracao');
  assert.equal((await call('/config',{},{ })).status,503);
  assert.equal((await call('/session',{method:'POST',body:JSON.stringify({document:env.TELESAUDE_V3_TEST_CPF})},{})).status,503);
  assert.equal((await call('/config',{}, {...env,WIDGET_ENVIRONMENT:'production'})).status,503);
});

test('configuração pública nunca inclui a Secret Key',async()=>{
  const res=await call('/config');
  assert.equal(res.status,200);
  const out=await res.json();
  assert.equal(out.apiKey,env.MEDIQUO_V3_API_KEY);
  assert.equal(JSON.stringify(out).includes(env.MEDIQUO_V3_SECRET_KEY),false);
});

test('CPF sozinho ou CPF diferente não acessam paciente',async()=>{
  const old=globalThis.fetch;let called=0;
  globalThis.fetch=async()=>{called++;throw Error('requisicao indevida')};
  try {
    const noPassword=await call('/session',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({document:env.TELESAUDE_V3_TEST_CPF})});
    assert.equal(noPassword.status,401);
    const anotherCpf=await call('/session',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.2'},body:JSON.stringify({document:'12345678901',testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(anotherCpf.status,401);
    assert.equal(called,0);
  }finally{globalThis.fetch=old;}
});

test('sincronização requer token secreto e permite somente CPF fictício configurado',async()=>{
  const old=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url:String(url),...init});return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}})};
  try {
    assert.equal((await call('/patients/sync',{method:'POST',body:JSON.stringify({patients:[{document:env.TELESAUDE_V3_TEST_CPF}]})})).status,401);
    assert.equal((await call('/patients/sync',{method:'POST',headers:{Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN},body:JSON.stringify({patients:[{document:'12345678901'}]})})).status,403);
    assert.equal((await call('/patients/sync',{method:'POST',headers:{Authorization:'Bearer '+env.TELESAUDE_V3_SYNC_TOKEN},body:JSON.stringify({patients:[{document:env.TELESAUDE_V3_TEST_CPF}]})})).status,200);
    assert.equal(calls.length,1);
    assert.equal(calls[0].method,'PUT');
    assert.equal(JSON.parse(calls[0].body).patients[0].plan,env.MEDIQUO_V3_PLAN);
  }finally{globalThis.fetch=old;}
});

test('paciente ativo autenticado apenas depois de CPF e senha corretos',async()=>{
  const old=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{
    calls.push(String(url));
    const data=String(url).endsWith('/authenticate')
      ?{access_token:'token-ficticio'}:{data:{plan:env.MEDIQUO_V3_PLAN,first_name:'Paciente'}};
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  try{
    const r=await call('/session',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.3'},body:JSON.stringify({document:env.TELESAUDE_V3_TEST_CPF,testPassword:env.TELESAUDE_V3_TEST_PASSWORD})});
    assert.equal(r.status,200);
    assert.equal((await r.json()).access_token,'token-ficticio');
    assert.equal(calls.length,2);
  }finally{globalThis.fetch=old;}
});

test('nova página usa domínio próprio e não incorpora segredos',async()=>{
  const html=await readFile(new URL('../telesaude/index.html',import.meta.url),'utf8');
  assert.match(html,/https:\/\/backend\.promovie\.tv\.br/);
  assert.match(html,/Senha privada de homologação/);
  assert.doesNotMatch(html,/MEDIQUO_V3_SECRET_KEY\s*=/);
  assert.match(html,/<title>TeleSaúde \| PromoVie<\/title>/);
});
