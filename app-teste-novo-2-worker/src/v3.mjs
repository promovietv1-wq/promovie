// PromoVie / MediQuo V3: homologacao estritamente limitada a UM paciente ficticio.
// Documentacao oficial: cadastro na API ID; sessao na API SDK; Widget no frontend.
// Nenhuma chave privada pode aparecer no GitHub, no HTML ou na resposta HTTP.
const PREFIX = '/api/mediquo/v3';
const MAX_BODY = 4096;
const ATTEMPTS = new Map();

function reply(status, body, cors = {}) {
  return new Response(JSON.stringify(body), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...cors
  }});
}
function value(env, name) { return typeof env[name] === 'string' ? env[name].trim() : ''; }
function digits(v) { return String(v ?? '').replace(/\D/g, ''); }
function apiUrl(raw, host, path) {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname === host && u.pathname.replace(/\/+$/, '') === path &&
      !u.port && !u.username && !u.password && !u.search && !u.hash ? u.href.replace(/\/+$/, '') : '';
  } catch { return ''; }
}
function sdkBase(env) { return apiUrl(value(env,'MEDIQUO_V3_BASE_URL'),'sdk.mediquo.com','/v1'); }
function idBase(env) {
  const raw=value(env,'MEDIQUO_V3_ID_BASE_URL');
  return apiUrl(raw,'api-portal.mediquo.com.br','') ||
         apiUrl(raw,'api-portal.mediquo-staging.com.br','');
}
function isReady(env) {
  return value(env,'TELESAUDE_V3_ENABLED') === 'true' &&
    value(env,'WIDGET_ENVIRONMENT') === 'production' &&
    Boolean(value(env,'MEDIQUO_V3_WIDGET_API_KEY')) &&
    Boolean(value(env,'MEDIQUO_V3_SDK_API_KEY')) &&
    Boolean(value(env,'MEDIQUO_V3_SDK_SECRET_KEY')) &&
    /^\d+$/.test(value(env,'MEDIQUO_V3_CLIENT_ID')) &&
    value(env,'MEDIQUO_V3_PLAN') === '345' &&
    value(env,'MEDIQUO_V3_ORIGIN') === 'SDK' &&
    Boolean(value(env,'MEDIQUO_V3_ID_EMAIL')) &&
    Boolean(value(env,'MEDIQUO_V3_ID_PASSWORD')) &&
    ['cpf','licence'].includes(value(env,'MEDIQUO_V3_SDK_AUTH_MODE')) &&
    value(env,'TELESAUDE_V3_TEST_PASSWORD').length >= 16 &&
    value(env,'TELESAUDE_V3_SYNC_TOKEN').length >= 24 &&
    /^\d{11}$/.test(value(env,'TELESAUDE_V3_TEST_CPF')) &&
    Boolean(idBase(env)) && Boolean(sdkBase(env)) &&
    String(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).includes('https://www.promovie.tv.br');
}
async function jsonInput(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) throw {code:413};
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>MAX_BODY) throw {code:413};
  try { return JSON.parse(raw); } catch { throw {code:400}; }
}
async function equalSecret(a,b) {
  if(typeof a!=='string'||!a||a.length>256||typeof b!=='string'||!b) return false;
  const e=new TextEncoder();
  const hashes=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',e.encode(s))));
  const x=new Uint8Array(hashes[0]),y=new Uint8Array(hashes[1]);
  let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}
function rateLimited(request) {
  // Defesa suplementar por instancia. Configurar rate limiting distribuido na Cloudflare.
  const ip=request.headers.get('CF-Connecting-IP')||'desconhecido';
  const now=Date.now();
  if(ATTEMPTS.size>300) for(const [k,v] of ATTEMPTS)if(now-v.since>900000)ATTEMPTS.delete(k);
  const entry=ATTEMPTS.get(ip);
  if(!entry||now-entry.since>900000){ATTEMPTS.set(ip,{since:now,count:1});return false;}
  entry.count++;return entry.count>8;
}
async function requestJson(url, options) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(18000)});
  let data=null;
  if(response.ok) {
    try {data=await response.json();} catch {data=null;}
  }
  return {ok:response.ok,status:response.status,data};
}
async function idToken(env) {
  const r=await requestJson(idBase(env)+'/auth/login',{method:'POST',headers:{
    'Content-Type':'application/json','Accept':'application/hal+json'
  },body:JSON.stringify({email:value(env,'MEDIQUO_V3_ID_EMAIL'),password:value(env,'MEDIQUO_V3_ID_PASSWORD')})});
  const token=r.data?.token;
  return r.ok && typeof token==='string' && token.length>0 ? token : '';
}
function idHeaders(token) {return {'Authorization':'Bearer '+token,'Accept':'application/hal+json'};}
function patientsList(data) {
  if(Array.isArray(data))return data;
  for(const arr of [data?.content,data?.items,data?.patients,data?.data?.content,
    data?.data?.patients,data?._embedded?.patients,data?._embedded?.patientList]){
    if(Array.isArray(arr))return arr;
  }
  return [];
}
function validPatient(p,env,cpf) {
  return p && digits(p.documentNumber)===cpf && p.active===true &&
    Number(p.clientId)===Number(value(env,'MEDIQUO_V3_CLIENT_ID')) &&
    Number(p.planId)===345;
}
async function lookupTestPatient(env,cpf) {
  const token=await idToken(env);
  if(!token)return null;
  const r=await requestJson(idBase(env)+'/patients?index='+encodeURIComponent(cpf)+'&size=20',{
    method:'GET',headers:idHeaders(token)
  });
  if(!r.ok)return null;
  return patientsList(r.data).find(p=>validPatient(p,env,cpf))||null;
}
async function sdkToken(env,cpf,patient) {
  const mode=value(env,'MEDIQUO_V3_SDK_AUTH_MODE');
  const licenceId=patient?.licenceId||patient?.licenseId||patient?.licence?.id||patient?.license?.id;
  if(mode==='licence' && (typeof licenceId!=='string' && typeof licenceId!=='number')) return '';
  const path=mode==='licence'
    ?'/patients/'+encodeURIComponent(String(licenceId))+'/token'
    :'/patients/authenticate?code='+encodeURIComponent(cpf);
  const r=await requestJson(sdkBase(env)+path,{method:'POST',headers:{
    'X-API-Key':value(env,'MEDIQUO_V3_SDK_API_KEY'),
    'X-Secret-Key':value(env,'MEDIQUO_V3_SDK_SECRET_KEY')
  }});
  const token=mode==='licence'?r.data?.token:(r.data?.access_token||r.data?.data?.access_token);
  return r.ok && typeof token==='string' && token.length>0 ?token:'';
}
export async function handleV3(request,env,cors={}) {
  const path=new URL(request.url).pathname,method=request.method;
  const ready=isReady(env);
  if(path===PREFIX+'/health'&&method==='GET')
    return reply(200,{status:ready?'homologacao-pronta':'aguardando-configuracao',mode:'homologacao-restrita',version:'3-sdk-id'},cors);
  if(path===PREFIX+'/config'&&method==='GET') {
    if(!ready)return reply(503,{error:'Integração em configuração.'},cors);
    // Somente a chave especifica do Widget. Credenciais da API ID e da API SDK nunca retornam.
    return reply(200,{apiKey:value(env,'MEDIQUO_V3_WIDGET_API_KEY'),environment:'production'},cors);
  }
  if(path===PREFIX+'/patients/sync'&&method==='POST') {
    if(!ready)return reply(503,{error:'Integração em configuração.'},cors);
    if(value(env,'TELESAUDE_V3_WRITE_ENABLED')!=='true')
      return reply(503,{error:'Cadastro de homologação ainda não autorizado.'},cors);
    const bearer=request.headers.get('Authorization')||'';
    if(!await equalSecret(bearer.startsWith('Bearer ')?bearer.slice(7):'',value(env,'TELESAUDE_V3_SYNC_TOKEN')))
      return reply(401,{error:'Não autorizado.'},cors);
    try {
      const body=await jsonInput(request),list=body?.patients;
      if(!Array.isArray(list)||list.length!==1||!list[0]||typeof list[0]!=='object')
        return reply(400,{error:'Somente um paciente de homologação.'},cors);
      const cpf=digits(list[0].document||list[0].cpf);
      if(cpf!==value(env,'TELESAUDE_V3_TEST_CPF')||list[0].active===false)
        return reply(403,{error:'Paciente não permitido na homologação.'},cors);
      const token=await idToken(env);
      if(!token)return reply(502,{error:'Não foi possível autenticar na API ID.'},cors);
      const r=await requestJson(idBase(env)+'/patients',{method:'POST',headers:{
        ...idHeaders(token),'Content-Type':'application/json'
      },body:JSON.stringify({
        documentNumber:cpf,name:'Paciente Homologacao',
        clientId:Number(value(env,'MEDIQUO_V3_CLIENT_ID')),
        planId:345,origin:'SDK'
      })});
      if(r.status===409)return reply(409,{error:'Paciente já cadastrado. Consulte o registro antes de repetir.'},cors);
      if(!r.ok)return reply(502,{error:'Não foi possível cadastrar o paciente de teste.'},cors);
      return reply(200,{ok:true,enviados:1},cors);
    }catch(e){return reply(e?.code===413?413:502,{error:'Não foi possível concluir o cadastro de homologação.'},cors);}
  }
  if(path===PREFIX+'/session'&&method==='POST') {
    if(!ready)return reply(503,{error:'Integração em configuração.'},cors);
    if(rateLimited(request))return reply(429,{error:'Muitas tentativas.'},cors);
    try {
      const body=await jsonInput(request),cpf=digits(body?.document);
      if(!/^\d{11}$/.test(cpf))return reply(400,{error:'CPF de teste inválido.'},cors);
      if(cpf!==value(env,'TELESAUDE_V3_TEST_CPF')||
         !await equalSecret(body?.testPassword,value(env,'TELESAUDE_V3_TEST_PASSWORD')))
        return reply(401,{error:'Acesso de homologação não autorizado.'},cors);
      const patient=await lookupTestPatient(env,cpf);
      if(!patient)return reply(403,{error:'Paciente de teste não encontrado ou inativo no plano.'},cors);
      const token=await sdkToken(env,cpf,patient);
      if(!token)return reply(502,{error:'Não foi possível autenticar a sessão SDK.'},cors);
      return reply(200,{access_token:token},cors);
    }catch(e){return reply(e?.code===413?413:502,{error:'Não foi possível validar o acesso.'},cors);}
  }
  return reply(404,{error:'Rota não encontrada.'},cors);
}
