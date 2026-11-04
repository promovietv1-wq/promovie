// SDK MediQuo V3 - fluxo fornecido pelo suporte no kit final de 30/10/2026.
// Habilitacao somente em homologacao, com um unico CPF de teste e senha privada.
// API de pacientes SDK: PUT/GET /patients e POST /patients/authenticate.
// Nenhuma credencial, CPF de paciente real ou token de sessao entra no GitHub.
const PREFIX='/api/mediquo/v3';
const MAX_BODY=4096;
const ATTEMPTS=new Map();

function value(env,key){return typeof env[key]==='string'?env[key].trim():'';}
function digits(x){return String(x??'').replace(/\D/g,'');}
function reply(status,body,cors={}){
  return new Response(JSON.stringify(body),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
    'X-Frame-Options':'DENY',...cors
  }});
}
function sdkBase(env){
  try{
    const u=new URL(value(env,'MEDIQUO_V3_BASE_URL'));
    if(u.protocol!=='https:'||u.hostname!=='sdk.mediquo.com'||
       u.pathname.replace(/\/+$/,'')!=='/v1'||u.port||u.username||u.password||u.search||u.hash)
      return '';
    return u.href.replace(/\/+$/,'');
  }catch{return '';}
}
function ready(env){
  return value(env,'TELESAUDE_V3_ENABLED')==='true' &&
    value(env,'WIDGET_ENVIRONMENT')==='production' &&
    Boolean(value(env,'MEDIQUO_V3_WIDGET_API_KEY')) &&
    Boolean(value(env,'MEDIQUO_V3_SDK_SECRET_KEY')) &&
    value(env,'MEDIQUO_V3_PLAN')==='345' &&
    value(env,'TELESAUDE_V3_TEST_PASSWORD').length>=16 &&
    value(env,'TELESAUDE_V3_SYNC_TOKEN').length>=24 &&
    /^\d{11}$/.test(value(env,'TELESAUDE_V3_TEST_CPF')) &&
    Boolean(sdkBase(env)) &&
    value(env,'ALLOWED_ORIGINS').split(',').map(s=>s.trim()).includes('https://www.promovie.tv.br');
}
async function jsonInput(request){
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw {code:413};
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>MAX_BODY)throw {code:413};
  try{return JSON.parse(raw);}catch{throw {code:400};}
}
async function sameSecret(a,b){
  if(typeof a!=='string'||!a||a.length>256||typeof b!=='string'||!b)return false;
  const e=new TextEncoder();
  const [ah,bh]=await Promise.all([a,b].map(s=>crypto.subtle.digest('SHA-256',e.encode(s))));
  const x=new Uint8Array(ah),y=new Uint8Array(bh);
  let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
  return diff===0;
}
function rateLimited(request){
  // Limite de seguranca complementar. Requer rate-limit distribuido para producao.
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  const now=Date.now();
  if(ATTEMPTS.size>300)for(const [k,v]of ATTEMPTS)if(now-v.since>900000)ATTEMPTS.delete(k);
  let r=ATTEMPTS.get(ip);
  if(!r||now-r.since>900000){r={since:now,count:0};ATTEMPTS.set(ip,r);}
  return ++r.count>8;
}
function vendorHeaders(env){
  // O pacote especifico enviado pelo Pedro usa a Secret Key no header X-API-Key.
  // Nao confundir com a API Key publica usada somente pelo Widget.
  return {'Content-Type':'application/json','X-API-Key':value(env,'MEDIQUO_V3_SDK_SECRET_KEY')};
}
async function vendor(env,path,method,data){
  const r=await fetch(sdkBase(env)+path,{method,headers:vendorHeaders(env),
    ...(data===undefined?{}:{body:JSON.stringify(data)}),
    signal:AbortSignal.timeout(18000)});
  if(!r.ok)return {ok:false,status:r.status};
  if(method==='PUT')return {ok:true,status:r.status};
  try{return {ok:true,data:await r.json(),status:r.status};}
  catch{return {ok:false,status:502};}
}
function unwrapPatient(data){
  const p=data?.data?.patient||data?.data||data?.patient||data;
  return p&&typeof p==='object'&&!Array.isArray(p)?p:null;
}
export async function handleV3(request,env,cors={}){
  const path=new URL(request.url).pathname,method=request.method;
  const configured=ready(env);
  if(path===PREFIX+'/health'&&method==='GET'){
    return reply(200,{status:configured?'homologacao-pronta':'aguardando-configuracao',
      mode:'homologacao-restrita',version:'3-sdk-kit-pedro'},cors);
  }
  if(path===PREFIX+'/config'&&method==='GET'){
    if(!configured)return reply(503,{error:'Integração em configuração.'},cors);
    return reply(200,{apiKey:value(env,'MEDIQUO_V3_WIDGET_API_KEY'),environment:'production'},cors);
  }
  if(path===PREFIX+'/patients/sync'&&method==='POST'){
    if(!configured)return reply(503,{error:'Integração em configuração.'},cors);
    if(value(env,'TELESAUDE_V3_WRITE_ENABLED')!=='true')
      return reply(503,{error:'Cadastro de homologação não autorizado.'},cors);
    const auth=request.headers.get('Authorization')||'';
    if(!await sameSecret(auth.startsWith('Bearer ')?auth.slice(7):'',value(env,'TELESAUDE_V3_SYNC_TOKEN')))
      return reply(401,{error:'Não autorizado.'},cors);
    try{
      const input=await jsonInput(request),list=input?.patients;
      if(!Array.isArray(list)||list.length!==1||!list[0]||typeof list[0]!=='object')
        return reply(400,{error:'Apenas um paciente de teste pode ser sincronizado.'},cors);
      const p=list[0],cpf=digits(p.document||p.cpf||p.code);
      if(cpf!==value(env,'TELESAUDE_V3_TEST_CPF')||p.active===false)
        return reply(403,{error:'Paciente não autorizado na homologação.'},cors);
      const patient={code:cpf,tax_id:cpf,plan:value(env,'MEDIQUO_V3_PLAN'),
        first_name:'Paciente',last_name:'Homologacao',locale:'pt'};
      const r=await vendor(env,'/patients','PUT',{patients:[patient]});
      if(!r.ok)return reply(502,{error:'Não foi possível sincronizar o paciente de teste.'},cors);
      return reply(200,{ok:true,enviados:1},cors);
    }catch(e){
      return reply(e?.code===413?413:e?.code===400?400:502,
        {error:'Não foi possível sincronizar.'},cors);
    }
  }
  if(path===PREFIX+'/session'&&method==='POST'){
    if(!configured)return reply(503,{error:'Integração em configuração.'},cors);
    if(rateLimited(request))return reply(429,{error:'Muitas tentativas.'},cors);
    try{
      const input=await jsonInput(request),cpf=digits(input?.document);
      if(!/^\d{11}$/.test(cpf))return reply(400,{error:'CPF de teste inválido.'},cors);
      if(cpf!==value(env,'TELESAUDE_V3_TEST_CPF')||
         !await sameSecret(input?.testPassword,value(env,'TELESAUDE_V3_TEST_PASSWORD')))
        return reply(401,{error:'Não autorizado.'},cors);
      const r=await vendor(env,'/patients/'+encodeURIComponent(cpf),'GET');
      if(!r.ok){
        if(r.status===404)return reply(403,{error:'Paciente de teste não encontrado.'},cors);
        return reply(502,{error:'Não foi possível consultar o paciente de teste.'},cors);
      }
      const p=unwrapPatient(r.data);
      if(!p||p.unsubscribed_at||p.active===false||String(p.plan)!=='345'||
         (p.code!==undefined&&digits(p.code)!==cpf))
        return reply(403,{error:'Paciente de teste sem plano ativo.'},cors);
      const auth=await vendor(env,'/patients/authenticate','POST',{code:cpf});
      const token=auth.data?.access_token||auth.data?.data?.access_token;
      if(!auth.ok||typeof token!=='string'||!token)
        return reply(502,{error:'Não foi possível gerar a sessão SDK.'},cors);
      return reply(200,{access_token:token},cors);
    }catch(e){
      return reply(e?.code===413?413:e?.code===400?400:502,
        {error:'Não foi possível validar a sessão.'},cors);
    }
  }
  return reply(404,{error:'Rota não encontrada.'},cors);
}
