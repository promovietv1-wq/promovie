// Diretório PromoVie: leitura do catálogo MediQuo SDK por sessão pessoal autenticada.
// Não altera o widget, pacientes, licenças, conversas ou tokens SDK.
const PREFIX="/api/promovie/directory/v1";
const SESSION_SECONDS=20*60;
const LIMIT=120;
const encoder=new TextEncoder();
const configured=env=>String(env.PROMOVIE_DIRECTORY_ENABLED||"")==="true"&&
  Boolean(env.PROMOVIE_BENEFICIARIOS_DB?.prepare)&&
  String(env.MEDIQUO_V3_PLAN||"")==="345"&&
  String(env.MEDIQUO_V3_BASE_URL||"").replace(/\/+$/,"")==="https://sdk.mediquo.com/v1"&&
  String(env.MEDIQUO_V3_WIDGET_API_KEY||"").length>0&&
  String(env.MEDIQUO_V3_SDK_SECRET_KEY||"").length>0&&
  String(env.TELESAUDE_V3_SYNC_TOKEN||"").length>=24;
const reply=(status,body,cors={})=>new Response(JSON.stringify(body),{status,headers:{
  "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0",
  "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'none'",...cors}});
function b64(bytes){
  let v="";for(const byte of bytes)v+=String.fromCharCode(byte);
  return btoa(v).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function sha(value){
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(value)))]
    .map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function tokenHash(env,token){
  return sha("PromoVie|DiretorioProfissionais|v1|"+token+"|"+env.TELESAUDE_V3_SYNC_TOKEN);
}
let schemaReady=false;
async function schema(db){
  if(schemaReady)return;
  await db.exec(
    "CREATE TABLE IF NOT EXISTS pv_directory_sessions ("+
      "token_hash TEXT PRIMARY KEY,beneficiario_id TEXT NOT NULL,"+
      "access_hash TEXT NOT NULL,expires_at INTEGER NOT NULL);\n"+
    "CREATE INDEX IF NOT EXISTS idx_pv_directory_exp ON pv_directory_sessions(expires_at);"
  );
  schemaReady=true;
}
// Chamado somente após validação do código individual e do paciente SDK ativo.
export async function issueDirectoryGrant(env,beneficiaryId,accessHash){
  if(!configured(env)||typeof beneficiaryId!=="string"||!beneficiaryId||
    !/^[a-f0-9]{64}$/.test(accessHash||""))return null;
  try{
    const db=env.PROMOVIE_BENEFICIARIOS_DB;
    await schema(db);
    const bytes=crypto.getRandomValues(new Uint8Array(32)),token=b64(bytes);
    const now=Math.floor(Date.now()/1000);
    await db.prepare("INSERT INTO pv_directory_sessions (token_hash,beneficiario_id,access_hash,expires_at) VALUES (?,?,?,?)")
      .bind(await tokenHash(env,token),beneficiaryId,accessHash,now+SESSION_SECONDS).run();
    return token;
  }catch{
    // O diretório é opcional: nunca interromper a sessão clínica.
    return null;
  }
}
function cleanText(value,max=120){
  return typeof value==="string"?value.trim().replace(/\s+/g," ").slice(0,max):"";
}
function normalizeCatalogue(data){
  let list=data;
  for(let i=0;i<4&&!Array.isArray(list);i++){
    if(!list||typeof list!=="object")return [];
    list=list.data??list.consultants??list.professionals??list.items??null;
  }
  if(!Array.isArray(list))return [];
  const found=new Set(),out=[];
  for(const person of list.slice(0,LIMIT*3)){
    if(!person||typeof person!=="object"||Array.isArray(person))continue;
    const id=String(person.hash??person.professional_id??"");
    const name=cleanText(person.name,90);
    if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||name.length<2||/[<>]/.test(name)||found.has(id))continue;
    found.add(id);
    const title=cleanText(person.title??person.speciality?.name??person.specialty?.name??"",90);
    const status=person.status==="online"?"online":person.status==="offline"?"offline":null;
    out.push({id,name,title,specialityId:String(person.speciality_id??"").slice(0,30),status});
    if(out.length>=LIMIT)break;
  }
  return out;
}
export async function handleDirectory(request,env,cors={}){
  const url=new URL(request.url),path=url.pathname;
  // Defesa contra solicitações fora do portal, independente do CORS superior.
  const origin=request.headers.get("Origin")||"";
  if(!String(env.ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).includes(origin))
    return reply(403,{error:"Origem não autorizada."},cors);
  if(path!==PREFIX+"/catalog"||request.method!=="GET")
    return reply(404,{error:"Rota não encontrada."},cors);
  if(!configured(env))return reply(503,{available:false},cors);
  const token=(request.headers.get("Authorization")||"").match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!token)return reply(401,{error:"Sessão não autorizada."},cors);
  try{
    const db=env.PROMOVIE_BENEFICIARIOS_DB;
    await schema(db);
    const key=await tokenHash(env,token),now=Math.floor(Date.now()/1000);
    const row=await db.prepare(
      "SELECT s.access_hash,c.code_hash,p.code_hash AS pending_hash "+
      "FROM pv_directory_sessions s JOIN pv_beneficiarios b ON b.id=s.beneficiario_id "+
      "LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id "+
      "LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id "+
      "WHERE s.token_hash=? AND s.expires_at>? AND b.situacao='ativo' AND b.plano='345'"
    ).bind(key,now).first();
    if(!row||(!row.code_hash&&!row.pending_hash)||
      (row.access_hash!==row.code_hash&&row.access_hash!==row.pending_hash))
      return reply(401,{error:"Sessão não autorizada."},cors);
    const response=await fetch("https://sdk.mediquo.com/v1/consultants",{
      method:"GET",headers:{
        "X-API-Key":String(env.MEDIQUO_V3_WIDGET_API_KEY),
        "X-Secret-Key":String(env.MEDIQUO_V3_SDK_SECRET_KEY),
        "Accept":"application/json"
      },signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)return reply(503,{available:false},cors);
    const length=Number(response.headers.get("Content-Length")||0);
    if(length>300000)return reply(502,{available:false},cors);
    const raw=await response.text();
    if(raw.length>300000)return reply(502,{available:false},cors);
    const items=normalizeCatalogue(JSON.parse(raw));
    return reply(200,{available:items.length>0,items},cors);
  }catch{return reply(503,{available:false},cors);}
}
