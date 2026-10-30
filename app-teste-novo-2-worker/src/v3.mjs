// PromoVie / MediQuo, API v3: teste isolado de paciente SDK.
// Acesso por CPF sozinho nunca emite sessao. Segredos nao devem entrar no repositorio.
const PREFIX = '/api/mediquo/v3';
const MAX_BODY = 4096;
const ATTEMPTS = new Map();

function reply(status, body, cors = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      ...cors
    }
  });
}
function digits(s) { return String(s ?? '').replace(/\D/g, ''); }
function secret(env, name) { return typeof env[name] === 'string' ? env[name].trim() : ''; }
function baseUrl(env) {
  try {
    const u = new URL(secret(env, 'MEDIQUO_V3_BASE_URL'));
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
        !u.hostname || !/^\/v1\/?$/.test(u.pathname)) return '';
    return u.href.replace(/\/+$/, '');
  } catch { return ''; }
}
function isReady(env) {
  return secret(env, 'TELESAUDE_V3_ENABLED') === 'true' &&
    secret(env, 'WIDGET_ENVIRONMENT') === 'sandbox' &&
    secret(env, 'MEDIQUO_V3_API_KEY').length > 0 &&
    secret(env, 'MEDIQUO_V3_SECRET_KEY').length > 0 &&
    secret(env, 'MEDIQUO_V3_PLAN').length > 0 &&
    !/COLE_AQUI|NOME_DO_PLANO|\[|\]/i.test(secret(env, 'MEDIQUO_V3_PLAN')) &&
    secret(env, 'TELESAUDE_V3_TEST_PASSWORD').length >= 16 &&
    secret(env, 'TELESAUDE_V3_SYNC_TOKEN').length >= 24 &&
    /^\d{11}$/.test(secret(env, 'TELESAUDE_V3_TEST_CPF')) &&
    baseUrl(env) !== '' &&
    String(env.ALLOWED_ORIGINS || '').includes('https://www.promovie.tv.br');
}
async function jsonInput(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw {code:413};
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY) throw {code:413};
  try { return JSON.parse(body); } catch { throw {code:400}; }
}
async function equalSecret(a, b) {
  if (typeof a !== 'string' || a.length < 1 || a.length > 256 || typeof b !== 'string') return false;
  const input = new TextEncoder();
  const [aHash,bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', input.encode(a)),
    crypto.subtle.digest('SHA-256', input.encode(b))
  ]);
  const x = new Uint8Array(aHash), y = new Uint8Array(bHash);
  let d = 0;
  for (let i=0;i<x.length;i++) d |= x[i]^y[i];
  return d===0;
}
function isRateLimited(request) {
  // Defesa adicional de homologacao. Rate limit distribuido exige controle no Cloudflare.
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
  const now=Date.now();
  if (ATTEMPTS.size > 300) {
    for(const [k,v] of ATTEMPTS) if(now-v.since>900000) ATTEMPTS.delete(k);
  }
  const v=ATTEMPTS.get(ip);
  if(!v||now-v.since>900000){ATTEMPTS.set(ip,{since:now,count:1});return false;}
  v.count++;
  return v.count>8;
}
async function vendor(env, path, method, data) {
  const response = await fetch(baseUrl(env) + path, {
    method,
    headers: {
      'X-API-Key': secret(env, 'MEDIQUO_V3_SECRET_KEY'),
      'Content-Type': 'application/json'
    },
    ...(data === undefined ? {} : {body: JSON.stringify(data)}),
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) return {ok:false,status:response.status};
  try { return {ok:true,body:await response.json()}; }
  catch { return {ok:false,status:502}; }
}
function patientFrom(body) {
  const data = body?.data || body;
  return data?.patient || data;
}

export async function handleV3(request, env, cors={}) {
  const route = new URL(request.url).pathname;
  const method = request.method;
  const ready = isReady(env);
  if (route === PREFIX + '/health' && method === 'GET') {
    return reply(200,{status:ready?'homologacao-pronta':'aguardando-configuracao',mode:'homologacao-restrita',version:'3-sdk'},cors);
  }
  if (route === PREFIX + '/config' && method === 'GET') {
    if (!ready) return reply(503,{error:'Integração em configuração.'},cors);
    return reply(200,{apiKey:secret(env,'MEDIQUO_V3_API_KEY'),environment:'sandbox'},cors);
  }
  if (route === PREFIX + '/patients/sync' && method === 'POST') {
    if (!ready) return reply(503,{error:'Integração em configuração.'},cors);
    const auth = request.headers.get('Authorization') || '';
    if (!await equalSecret(auth.startsWith('Bearer ')?auth.slice(7):'',secret(env,'TELESAUDE_V3_SYNC_TOKEN'))) {
      return reply(401,{error:'Não autorizado.'},cors);
    }
    try {
      const body=await jsonInput(request), patients=body?.patients;
      if(!Array.isArray(patients)||patients.length!==1 || !patients[0] || typeof patients[0]!=='object') {
        return reply(400,{error:'Homologação restrita a um paciente de teste.'},cors);
      }
      const p=patients[0], cpf=digits(p.document || p.cpf);
      if (cpf!==secret(env,'TELESAUDE_V3_TEST_CPF') || p.active===false) {
        return reply(403,{error:'Apenas o paciente de homologação pode ser sincronizado.'},cors);
      }
      const patient={code:cpf,tax_id:cpf,plan:secret(env,'MEDIQUO_V3_PLAN'),locale:'pt',first_name:'Paciente',last_name:'Homologacao'};
      const result=await vendor(env,'/patients','PUT',{patients:[patient]});
      if(!result.ok) return reply(502,{error:'Não foi possível sincronizar o paciente de teste.'},cors);
      return reply(200,{ok:true,enviados:1},cors);
    }catch(e){return reply(e?.code||502,{error:e?.code===413?'Solicitação muito grande.':'Não foi possível sincronizar.'},cors);}
  }
  if (route === PREFIX + '/session' && method === 'POST') {
    if (!ready) return reply(503,{error:'Integração em configuração.'},cors);
    if(isRateLimited(request)) return reply(429,{error:'Muitas tentativas. Tente mais tarde.'},cors);
    try {
      const body=await jsonInput(request);
      const cpf=digits(body?.document);
      if(!/^\d{11}$/.test(cpf)) return reply(400,{error:'Informe um CPF com 11 dígitos.'},cors);
      if (cpf!==secret(env,'TELESAUDE_V3_TEST_CPF') ||
          !await equalSecret(body?.testPassword,secret(env,'TELESAUDE_V3_TEST_PASSWORD'))) {
        return reply(401,{error:'Acesso de homologação não autorizado.'},cors);
      }
      const result=await vendor(env,'/patients/'+encodeURIComponent(cpf),'GET');
      if(!result.ok){
        if(result.status===404) return reply(403,{error:'Paciente de homologação indisponível.'},cors);
        return reply(502,{error:'Não foi possível confirmar o cadastro.'},cors);
      }
      const patient=patientFrom(result.body);
      if(!patient || patient.unsubscribed_at || patient.active===false || !patient.plan) {
        return reply(403,{error:'Paciente de homologação sem plano ativo.'},cors);
      }
      const auth=await vendor(env,'/patients/authenticate','POST',{code:cpf});
      const token=auth.body?.access_token || auth.body?.data?.access_token;
      if(!auth.ok || typeof token!=='string' || !token) {
        return reply(502,{error:'Não foi possível abrir o atendimento.'},cors);
      }
      return reply(200,{access_token:token},cors);
    }catch(e){return reply(e?.code||502,{error:e?.code===413?'Solicitação muito grande.':'Não foi possível validar o acesso.'},cors);}
  }
  return reply(404,{error:'Rota não encontrada.'},cors);
}