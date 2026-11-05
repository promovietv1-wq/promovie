import {page} from './page.mjs';

// Worker auxiliar independente. NUNCA cria ou modifica pacientes e licenças.
// Acesso protegido por senha exclusiva em Cloudflare Secrets.
const BASE='https://sdk.mediquo.com/v1';
const encoder=new TextEncoder();
const attempts=new Map();
const common={
  'Cache-Control':'no-store, max-age=0','Referrer-Policy':'no-referrer',
  'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
  'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"
};
function reply(status,data){return new Response(JSON.stringify(data),{status,headers:{...common,'Content-Type':'application/json; charset=utf-8'}});}
function val(env,k){return typeof env[k]==='string'?env[k].trim():'';}
function same(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!b||a.length>512)return false;
  const x=encoder.encode(a),y=encoder.encode(b);let d=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)d|=(x[i]||0)^(y[i]||0);
  return d===0;
}
function rate(request){
  const ip=request.headers.get('CF-Connecting-IP')||'unknown',now=Date.now();
  if(attempts.size>300)for(const [k,v] of attempts)if(now-v.since>600000)attempts.delete(k);
  let a=attempts.get(ip);
  if(!a||now-a.since>600000){a={since:now,count:0};attempts.set(ip,a);}
  return ++a.count<=6;
}
function summary(body){
  if(Array.isArray(body))return {tipo:'lista',quantidade:body.length};
  if(!body||typeof body!=='object')return {tipo:'inesperado'};
  for(const v of [body.data,body.professionals,body.consultants,body.data?.data,body.data?.professionals]){
    if(Array.isArray(v))return {tipo:'lista',quantidade:v.length};
  }
  return {tipo:'objeto_sem_lista'};
}
async function call(apiKey,secret,verb,path,payload){
  try{
    const r=await fetch(BASE+path,{method:verb,headers:{
      'Content-Type':'application/json','X-API-Key':apiKey,'X-Secret-Key':secret
    },...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(12000)});
    if(!r.ok)return {status:r.status,resultado:'erro_http'};
    let data;
    try{data=await r.json();}catch{return {status:r.status,resultado:'json_invalido'};}
    if(verb==='POST')return {status:r.status,resultado:'autenticou',
      tokenRecebido:Boolean(data?.access_token||data?.data?.access_token)};
    return {status:r.status,resultado:'consulta',...summary(data)};
  }catch{return {status:null,resultado:'erro_de_rede_ou_tempo'};}
}
async function probe(apiKey,secret,cpf){
  const [consultants,professionals]=await Promise.all([
    call(apiKey,secret,'GET','/consultants'),
    call(apiKey,secret,'GET','/professionals')
  ]);
  const out={consultants,professionals};
  if(cpf){
    // Autentica um paciente já existente; não executa PUT/DELETE/PATCH.
    out.auth_query=await call(apiKey,secret,'POST','/patients/authenticate?code='+encodeURIComponent(cpf));
    out.auth_body=await call(apiKey,secret,'POST','/patients/authenticate',{code:cpf});
  }
  return out;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==='GET'&&url.pathname==='/'){
      return new Response(page,{headers:{...common,'Content-Type':'text/html; charset=utf-8',
        'X-Robots-Tag':'noindex, nofollow'}});
    }
    if(request.method!=='POST'||url.pathname!=='/diagnostico')return reply(404,{erro:'Rota inexistente.'});
    if(!rate(request))return reply(429,{erro:'Limite de diagnósticos atingido. Aguarde 10 minutos.'});
    if(request.headers.get('Origin')!==url.origin)return reply(403,{erro:'Origem não autorizada.'});
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return reply(415,{erro:'Envie JSON.'});
    const passwd=val(env,'DIAG_ACCESS_PASSWORD');
    if(passwd.length<24||!same((request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,''),passwd))
      return reply(401,{erro:'Senha exclusiva do diagnóstico inválida ou ausente.'});
    let text;
    try{text=await request.text();}catch{return reply(400,{erro:'Requisição inválida.'});}
    if(encoder.encode(text).length>512)return reply(413,{erro:'Requisição muito grande.'});
    let body;
    try{body=JSON.parse(text);}catch{return reply(400,{erro:'JSON inválido.'});}
    const cpf=body?.cpf===undefined||body?.cpf===''?'':String(body.cpf).replace(/\D/g,'');
    if(cpf&&!/^\d{11}$/.test(cpf))return reply(400,{erro:'CPF inválido.'});
    const apiKey=val(env,'DIAG_API_KEY');
    if(!apiKey)return reply(503,{erro:'API Key pública não configurada.'});
    const out={aviso:'Resultado resumido; sem CPF, segredo, nomes ou tokens.',
      ambiente:'production',plano_referencia:'345',configuracoes:{}};
    for(const [label,key] of [['cliente','DIAG_CLIENT_SECRET_KEY'],['parceiro','DIAG_PARTNER_SECRET_KEY']]){
      const secret=val(env,key);
      out.configuracoes[label]=secret?await probe(apiKey,secret,cpf):{resultado:'chave_nao_configurada'};
    }
    return reply(200,out);
  }
};
