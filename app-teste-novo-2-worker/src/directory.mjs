// Diretorio autorizado: lista de profissionais por paciente autenticado, sem acesso a mensagens.
// Nunca guardar tokens SDK, prontuarios ou mensagens; diretório de paciente e perfis públicos separados.
const PREFIX="/api/promovie/directory/v1",MAX=160,SESSION_SECONDS=15*60;
const enc=new TextEncoder();
function setting(env,k){return typeof env[k]==="string"?env[k].trim():"";}
function ready(env){return setting(env,"PROMOVIE_DIRECTORY_ENABLED")==="true"&&
  Boolean(env.PROMOVIE_BENEFICIARIOS_DB?.prepare)&&
  setting(env,"MEDIQUO_V3_PLAN")==="345"&&
  setting(env,"MEDIQUO_V3_BASE_URL").replace(/\/+$/,"")==="https://sdk.mediquo.com/v1"&&
  !!setting(env,"MEDIQUO_V3_WIDGET_API_KEY")&&setting(env,"TELESAUDE_V3_SYNC_TOKEN").length>=24;}
const reply=(status,body,cors={})=>new Response(JSON.stringify(body),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0",
  "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'none'",...cors}});
function b64(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function sha(s){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))]
  .map(x=>x.toString(16).padStart(2,"0")).join("");}
async function grantHash(env,token){return sha("PromoVie|Directory|v2|"+token+"|"+env.TELESAUDE_V3_SYNC_TOKEN);}
async function sdkHash(env,token){return sha("PromoVie|DirectorySDK|v2|"+token+"|"+env.TELESAUDE_V3_SYNC_TOKEN);}
let schemaReady=false;
async function ensureSchema(db){
  if(schemaReady)return;
  await db.exec("CREATE TABLE IF NOT EXISTS pv_directory_sessions_v2 ("+
    "token_hash TEXT PRIMARY KEY,beneficiario_id TEXT NOT NULL,"+
    "access_hash TEXT NOT NULL,sdk_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);\n"+
    "CREATE INDEX IF NOT EXISTS idx_pv_directory_v2_exp ON pv_directory_sessions_v2(expires_at);");
  schemaReady=true;
}
function validSdkToken(t){return typeof t==="string"&&t.length>=24&&t.length<=4096&&
  !/[\s<>"']/g.test(t);}
export async function issueDirectoryGrant(env,beneficiaryId,accessHash,sdkToken){
  if(!ready(env)||typeof beneficiaryId!=="string"||!beneficiaryId||
    !/^[a-f0-9]{64}$/.test(accessHash||"")||!validSdkToken(sdkToken))return null;
  try{
    const db=env.PROMOVIE_BENEFICIARIOS_DB;await ensureSchema(db);
    const token=b64(crypto.getRandomValues(new Uint8Array(32)));
    await db.prepare("INSERT INTO pv_directory_sessions_v2 "+
      "(token_hash,beneficiario_id,access_hash,sdk_hash,expires_at) VALUES (?,?,?,?,?)")
      .bind(await grantHash(env,token),beneficiaryId,accessHash,
        await sdkHash(env,sdkToken),Math.floor(Date.now()/1000)+SESSION_SECONDS).run();
    return token;
  }catch{return null;}
}
function text(s){return typeof s==="string"?s.trim().replace(/\s+/g," "):"";}
function biography(value){
  if(typeof value!=="string")return "";
  // Alguns perfis são formatados em HTML pelo próprio fornecedor.
  // Remove também conteúdo de scripts/estilos, mas preserva o texto profissional.
  return value.replace(/<(script|style|iframe|object)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"")
    .replace(/<\s*(?:br\s*\/??|\/p|\/div|\/li)\s*>/gi,"\n")
    .replace(/<[^>]*>/g," ")
    .replace(/&(?:nbsp|#160);/gi," ")
    .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
    .replace(/&quot;/gi,'"').replace(/&#(?:39|x27);/gi,"'")
    .replace(/[ \t]+/g," ").replace(/\n\s*\n\s*\n+/g,"\n\n")
    .trim().slice(0,1800);
}
function safeAvatar(value,publicProfile){
  const raw=text(value);if(!raw)return "";
  try{
    const url=publicProfile&&raw.startsWith("/")&&!raw.startsWith("//")?
      new URL(raw,"https://api.mediquo.com"):new URL(raw);
    if(url.protocol!=="https:"||url.username||url.password||
      (url.port&&url.port!=="443"))return "";
    const host=url.hostname.toLowerCase();
    if(!host||host==="localhost"||host.endsWith(".localhost")||
      host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith("["))return "";
    // Somente URI devolvida pelo fornecedor autenticado; referrer-policy no-referrer no navegador.
    if(!publicProfile&&!(host==="mediquo.com"||host.endsWith(".mediquo.com")||
       host==="mediquo.com.br"||host.endsWith(".mediquo.com.br")))return "";
    return url.href;
  }catch{return "";}
}
export function projectPatientProfessionals(payload,{publicProfile=false}={}){
  let list=payload;
  for(let i=0;i<3&&!Array.isArray(list);i++){
    if(!list||typeof list!=="object")return [];
    list=list.data??list.professionals??list.items??list.consultants??list.results??null;
  }
  if(!Array.isArray(list))return [];
  const ids=new Set(),out=[];
  for(const p of list.slice(0,MAX*3)){
    // A documentação pública do SDK não exige is_available: quando o campo é
    // omitido, o profissional retornado pela consulta autenticada continua elegível.
    // Uma negativa explícita permanece bloqueada.
    if(!p||typeof p!=="object"||p.is_available===false)continue;
    const hash=text(p.hash),name=text(p.name),title=text(p.title);
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(hash)||ids.has(hash)||
      name.length<2||name.length>90||/[<>]/.test(name)||
      title.length>90||/[<>]/.test(title))continue;
    ids.add(hash);
    const description=publicProfile?biography(p.description):text(p.description).slice(0,500);
    const avatar=safeAvatar(p.avatar,publicProfile);
    out.push({id:hash,name,title,
      status:p.status==="online"?"online":p.status==="offline"?"offline":null,
      ...(description&&(publicProfile||!/[<>]/.test(description))?{description}:{}),
      ...(avatar?{avatar}:{}),
      ...(typeof p.speciality_id==="string"&&/^[A-Za-z0-9_-]{1,32}$/.test(p.speciality_id)?{speciality_id:p.speciality_id}:{}),
      ...(publicProfile&&typeof p.collegiate_number==="string"&&
          p.collegiate_number.trim().length>1&&p.collegiate_number.trim().length<=90&&
          !/[<>]/.test(p.collegiate_number)?
          {collegiate_number:p.collegiate_number.trim()}:{}),
      ...(publicProfile&&typeof p.speciality==="string"&&
          p.speciality.trim().length<=90&&!/[<>]/.test(p.speciality)?
          {speciality:p.speciality.trim()}:{}),
      ...(publicProfile&&Array.isArray(p.languages)?
          {languages:p.languages.filter(x=>typeof x==="string"&&x.length<=40&&!/[<>]/.test(x)).slice(0,8)}:{})
    });
    if(out.length>=MAX)break;
  }
  return out;
}
export function combineAuthorizedProfiles(authorized,consultants){
  if(!Array.isArray(authorized))return [];
  // O catálogo de pacientes é a ÚNICA autoridade para permissão de atendimento.
  // Consultores externos apenas completam campos de IDs exatamente iguais.
  const enriched=new Map(projectPatientProfessionals(consultants,{publicProfile:true})
    .map(p=>[p.id,p]));
  return authorized.map(p=>{
    const extra=enriched.get(p.id);
    if(!extra)return p;
    return {...p,
      ...(extra.avatar?{avatar:extra.avatar}:{}),
      ...(extra.description?{description:extra.description}:{}),
      ...(extra.collegiate_number?{collegiate_number:extra.collegiate_number}:{}),
      ...(extra.languages?.length?{languages:extra.languages}:{}),
      ...(extra.status?{status:extra.status}:{}),
    };
  });
}
async function fetchVendorProfileList(env){
  const apiKey=setting(env,"MEDIQUO_V3_WIDGET_API_KEY");
  const secret=setting(env,"MEDIQUO_V3_SDK_SECRET_KEY");
  // Endpoint /v1/consultants exige os headers oficiais SDK API.
  // A chave secreta nunca é entregue ao navegador.
  if(!apiKey||!secret)return null;
  try{
    const response=await fetch("https://sdk.mediquo.com/v1/consultants",{
      method:"GET",headers:{
        "X-API-Key":apiKey,"X-Secret-Key":secret,
        "Accept-Language":"pt","Accept":"application/json"
      },signal:AbortSignal.timeout(9000)
    });
    if(!response.ok)return null;
    if(Number(response.headers.get("Content-Length")||0)>350000)return null;
    const raw=await response.text();
    if(raw.length>350000)return null;
    return JSON.parse(raw);
  }catch{return null;}
}
export async function handleDirectory(request,env,cors={}){
  const url=new URL(request.url);
  const o=request.headers.get("Origin")||"";
  if(!setting(env,"ALLOWED_ORIGINS").split(",").map(x=>x.trim()).includes(o))
    return reply(403,{error:"Origem não autorizada."},cors);
  // Endpoint expandido exclusivo da nova homologação, sem alterar o /catalog.
  const publicProfile=url.pathname===PREFIX+"/catalog-profile";
  if((url.pathname!==PREFIX+"/catalog"&&!publicProfile)||request.method!=="POST")
    return reply(404,{error:"Rota não encontrada."},cors);
  if(!ready(env))return reply(503,{available:false},cors);
  const grant=(request.headers.get("Authorization")||"").match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!grant)return reply(401,{error:"Acesso não autorizado."},cors);
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type")||""))
    return reply(415,{error:"Formato inválido."},cors);
  try{
    const content=await request.text();
    if(content.length>5000)return reply(413,{error:"Requisição grande demais."},cors);
    const token=JSON.parse(content)?.sdk_access_token;
    if(!validSdkToken(token))return reply(401,{error:"Acesso não autorizado."},cors);
    const db=env.PROMOVIE_BENEFICIARIOS_DB;await ensureSchema(db);
    const row=await db.prepare(
      "SELECT s.sdk_hash,s.access_hash,c.code_hash,p.code_hash AS pending_hash "+
      "FROM pv_directory_sessions_v2 s "+
      "JOIN pv_beneficiarios b ON b.id=s.beneficiario_id "+
      "LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id "+
      "LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id "+
      "WHERE s.token_hash=? AND s.expires_at>? AND b.situacao='ativo' AND b.plano='345'"
    ).bind(await grantHash(env,grant),Math.floor(Date.now()/1000)).first();
    if(!row||(row.access_hash!==row.code_hash&&row.access_hash!==row.pending_hash)||
      row.sdk_hash!==await sdkHash(env,token))
      return reply(401,{error:"Sessão não autorizada."},cors);
    // Replicar SOMENTE a chamada GET que o próprio Widget Web faz para o paciente.
    const r=await fetch("https://sdk.mediquo.com/v1/professionals",{
      method:"GET",headers:{
        "X-API-Key":setting(env,"MEDIQUO_V3_WIDGET_API_KEY"),
        "Authorization":"Bearer "+token,
        "Accept-Language":"pt","Content-Type":"application/json"
      },signal:AbortSignal.timeout(9000)
    });
    if(!r.ok)return reply(503,{available:false},cors);
    if(Number(r.headers.get("Content-Length")||0)>350000)return reply(502,{available:false},cors);
    const raw=await r.text();
    if(raw.length>350000)return reply(502,{available:false},cors);
    let items=projectPatientProfessionals(JSON.parse(raw),{publicProfile});
    if(publicProfile&&items.length){
      const consultantPayload=await fetchVendorProfileList(env);
      if(consultantPayload)items=combineAuthorizedProfiles(items,consultantPayload);
      return reply(200,{
        available:true,items,
        profileData:{
          photos:items.filter(x=>Boolean(x.avatar)).length,
          descriptions:items.filter(x=>Boolean(x.description)).length,
          supplierProfileAvailable:Boolean(consultantPayload)
        }
      },cors);
    }
    return reply(200,{available:items.length>0,items},cors);
  }catch{return reply(503,{available:false},cors);}
}
