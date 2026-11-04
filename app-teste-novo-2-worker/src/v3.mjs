// SDK MediQuo V3 - fluxo fornecido pelo suporte no kit final de 30/10/2026.
// Liberacao restrita a um CPF autorizado e senha privada durante a primeira ativacao.
// API de pacientes SDK: PUT/GET /patients e POST /patients/authenticate.
// Nenhuma credencial, CPF de paciente ou token de sessao entra no GitHub.
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
  // A documentacao oficial exige OS DOIS headers, nunca apenas a Secret Key.
  return {'Content-Type':'application/json',
    'X-API-Key':value(env,'MEDIQUO_V3_WIDGET_API_KEY'),
    'X-Secret-Key':value(env,'MEDIQUO_V3_SDK_SECRET_KEY')};
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
function validCPF(cpf){
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
  for(let length=9;length<=10;length++){
    let sum=0;
    for(let i=0;i<length;i++)sum+=Number(cpf[i])*(length+1-i);
    let digit=(sum*10)%11;
    if(digit===10)digit=0;
    if(digit!==Number(cpf[length]))return false;
  }
  return true;
}
function safeName(name){
  if(typeof name!=='string')return '';
  const s=name.trim().replace(/\s+/g,' ');
  return s.length>=2&&s.length<=100&&!/[\d<>]/.test(s)?s:'';
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
  // Gestão restrita ao operador da PromoVie. Inicialmente, um único CPF autorizado.
  // Em nenhuma hipótese o formulário público de atendimento cadastra pacientes.
  if(method==='POST'&&(path===PREFIX+'/admin/patients/lookup'||
                      path===PREFIX+'/admin/patients/register')){
    if(rateLimited(request))return reply(429,{error:'Muitas tentativas. Aguarde.'},cors);
    const adminToken=request.headers.get('Authorization')||'';
    if(!value(env,'TELESAUDE_V3_SYNC_TOKEN')||
      !await sameSecret(adminToken.startsWith('Bearer ')?adminToken.slice(7):'',
                        value(env,'TELESAUDE_V3_SYNC_TOKEN')))
      return reply(401,{error:'Acesso administrativo não autorizado.'},cors);
    if(!value(env,'MEDIQUO_V3_WIDGET_API_KEY')||
       !value(env,'MEDIQUO_V3_SDK_SECRET_KEY')||
       !sdkBase(env)||value(env,'MEDIQUO_V3_PLAN')!=='345')
      return reply(503,{error:'Integração do Token PromoVie ainda não configurada.'},cors);
    try{
      const input=await jsonInput(request);
      const cpf=digits(input?.document);
      if(!validCPF(cpf))return reply(400,{error:'Informe um CPF válido.'},cors);
      // A primeira etapa NUNCA pode cadastrar/consultar CPFs arbitrários.
      if(cpf!==value(env,'TELESAUDE_V3_TEST_CPF'))
        return reply(403,{error:'CPF ainda não autorizado para a primeira ativação.'},cors);
      if(path===PREFIX+'/admin/patients/lookup'){
        const r=await vendor(env,'/patients/'+encodeURIComponent(cpf),'GET');
        if(r.status===404)return reply(200,{found:false},cors);
        if(!r.ok)return reply(502,{error:'Não foi possível consultar o paciente no Token PromoVie.'},cors);
        const p=unwrapPatient(r.data);
        if(!p||((p.code!==undefined)&&digits(p.code)!==cpf))
          return reply(502,{error:'Resposta inesperada do Token PromoVie.'},cors);
        return reply(200,{found:true,active:!p.unsubscribed_at&&
          p.active!==false&&String(p.plan||'')==='345',
          name:typeof p.first_name==='string'&&typeof p.last_name==='string'
            ? (p.first_name+' '+p.last_name).trim():null,
          plan:String(p.plan||'')},cors);
      }
      if(value(env,'TELESAUDE_V3_WRITE_ENABLED')!=='true')
        return reply(503,{error:'Cadastro ainda bloqueado. A consulta permanece disponível.'},cors);
      if(!await sameSecret(input?.testPassword,value(env,'TELESAUDE_V3_TEST_PASSWORD')))
        return reply(401,{error:'Senha de autorização inválida.'},cors);
      const name=safeName(input?.name);
      if(!name||name.split(' ').length<2)
        return reply(400,{error:'Informe nome completo e sobrenome.'},cors);
      const existing=await vendor(env,'/patients/'+encodeURIComponent(cpf),'GET');
      if(existing.ok)
        return reply(409,{error:'CPF já consta no Token PromoVie. Consulte antes de alterar a licença.'},cors);
      if(existing.status!==404)
        return reply(502,{error:'Não foi possível verificar se já existe cadastro. Nenhuma inclusão efetuada.'},cors);
      const parts=name.split(' ');
      const patient={code:cpf,tax_id:cpf,first_name:parts.shift(),
        last_name:parts.join(' '),plan:'345',locale:'pt'};
      if(input.email){
        if(typeof input.email!=='string'||input.email.length>180||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
          return reply(400,{error:'E-mail inválido.'},cors);
        patient.email=input.email.trim();
      }
      if(input.phone){
        const phone=digits(input.phone);
        if(phone.length!==10&&phone.length!==11)
          return reply(400,{error:'Telefone inválido.'},cors);
        patient.phone=phone;
      }
      const saved=await vendor(env,'/patients','PUT',{patients:[patient]});
      if(!saved.ok)
        return reply(502,{error:'O Token PromoVie não confirmou o envio do cadastro.'},cors);
      return reply(202,{ok:true,status:'enviado',
        message:'Cadastro enviado ao Token PromoVie. Consulte novamente para confirmar ativação.'},cors);
    }catch(e){
      return reply(e?.code===413?413:e?.code===400?400:502,
        {error:'Não foi possível processar a operação administrativa.'},cors);
    }
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
      const name=safeName(p.name);
      if(!name||!name.includes(' '))return reply(400,{error:'Nome completo obrigatório.'},cors);
      const words=name.split(' ');
      const patient={code:cpf,tax_id:cpf,plan:value(env,'MEDIQUO_V3_PLAN'),
        first_name:words.shift(),last_name:words.join(' '),locale:'pt'};
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
      if(!validCPF(cpf))return reply(400,{error:'CPF inválido.'},cors);
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
      const auth=await vendor(env,'/patients/authenticate?code='+encodeURIComponent(cpf),'POST');
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
