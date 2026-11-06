// Meu Espaço de Saúde | API independente do SDK Médiquo.
// D1 armazena exclusivamente envelopes cifrados no navegador.
// Não aceitar CPF, identificador de beneficiário ou chave de criptografia em rotas de dados.
const BASE="/api/promovie/space/v1";
const MAX_VAULT_CIPHER=110000;
const MAX_FILE_CIPHER=710000; // base64url de até ~520 KiB de arquivo cifrado
const MAX_FILES=10;
const SESSION_SECONDS=30*60;
const ENCODER=new TextEncoder();
const ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function setting(env,key){return typeof env[key]==="string"?env[key].trim():"";}
function enabled(env){return setting(env,"PROMOVIE_SPACE_ENABLED")==="true"&&
  !!env.PROMOVIE_BENEFICIARIOS_DB?.prepare&&
  setting(env,"PROMOVIE_ADMIN_DATA_KEY").length>=32&&
  setting(env,"TELESAUDE_V3_SYNC_TOKEN").length>=24;}
function response(status,obj,cors={}){
  return new Response(JSON.stringify(obj),{status,headers:{
    "Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store, max-age=0",
    "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
    "Content-Security-Policy":"default-src 'none'","X-Frame-Options":"DENY",...cors}});
}
function originOK(request,env){
  const o=request.headers.get("Origin")||"";
  return !!o&&setting(env,"ALLOWED_ORIGINS").split(",").map(x=>x.trim()).includes(o);
}
function digits(value){return String(value??"").replace(/\D/g,"");}
function validCPF(cpf){
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
  for(let n=9;n<=10;n++){
    let sum=0;
    for(let i=0;i<n;i++)sum+=Number(cpf[i])*(n+1-i);
    let digit=sum*10%11;
    if(digit===10)digit=0;
    if(digit!==Number(cpf[n]))return false;
  }
  return true;
}
function hex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");}
async function sha(input){return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",ENCODER.encode(input))));}
async function hmacHex(secret,message){
  const bits=await crypto.subtle.digest("SHA-256",ENCODER.encode(secret));
  const key=await crypto.subtle.importKey("raw",bits,{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,ENCODER.encode(message))));
}
async function cpfIndex(env,cpf){return hmacHex("PromoVie|Indice|v1|"+setting(env,"PROMOVIE_ADMIN_DATA_KEY"),cpf);}
async function accessCodeHash(env,idx,code){return hmacHex("PromoVie|CodigoAcesso|v1|"+setting(env,"PROMOVIE_ADMIN_DATA_KEY"),idx+"|"+code);}
function equalHex(a,b){
  if(typeof a!=="string"||typeof b!=="string"||a.length!==64||b.length!==64)return false;
  let d=0;for(let i=0;i<64;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);
  return d===0;
}
function randomToken(){
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  let s="";for(const b of bytes)s+=String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
async function jsonBody(request,max){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type")||""))
    throw {status:415};
  const len=Number(request.headers.get("Content-Length"));
  if(Number.isFinite(len)&&len>max)throw {status:413};
  const raw=await request.text();
  if(ENCODER.encode(raw).byteLength>max)throw {status:413};
  try{const x=JSON.parse(raw);if(!x||typeof x!=="object"||Array.isArray(x))throw Error();return x;}
  catch{throw {status:400};}
}
let tableReady=false;
async function setup(env){
  if(tableReady)return;
  await env.PROMOVIE_BENEFICIARIOS_DB.exec([
    "CREATE TABLE IF NOT EXISTS pv_space_attempts (actor_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);",
    "CREATE TABLE IF NOT EXISTS pv_space_sessions (token_hash TEXT PRIMARY KEY, beneficiario_id TEXT NOT NULL, code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);",
    "CREATE INDEX IF NOT EXISTS idx_pv_space_session_owner ON pv_space_sessions(beneficiario_id);",
    "CREATE TABLE IF NOT EXISTS pv_space_vaults (beneficiario_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, salt TEXT NOT NULL, iv TEXT NOT NULL, ciphertext TEXT NOT NULL, updated_at TEXT NOT NULL);",
    "CREATE TABLE IF NOT EXISTS pv_space_consents (beneficiario_id TEXT PRIMARY KEY, accepted_at TEXT NOT NULL, policy_version TEXT NOT NULL);",
    "CREATE TABLE IF NOT EXISTS pv_space_documents (id TEXT PRIMARY KEY, beneficiario_id TEXT NOT NULL, ciphertext TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL);",
    "CREATE INDEX IF NOT EXISTS idx_pv_space_docs_owner ON pv_space_documents(beneficiario_id);"
  ].join("\n"));
  tableReady=true;
}
async function login(request,env,cors){
  const input=await jsonBody(request,2048);
  const cpf=digits(input.cpf),code=String(input.codigo??"").trim().toUpperCase().replace(/[\s-]/g,"");
  if(!validCPF(cpf)||!/^[A-HJ-NP-Z2-9]{20}$/.test(code))
    return response(401,{error:"CPF ou código não autorizado."},cors);
  const db=env.PROMOVIE_BENEFICIARIOS_DB,idx=await cpfIndex(env,cpf),now=Math.floor(Date.now()/1000);
  const actor=await sha("space-attempt|"+idx+"|"+setting(env,"TELESAUDE_V3_SYNC_TOKEN"));
  const prior=await db.prepare("SELECT attempts,expires_at FROM pv_space_attempts WHERE actor_hash=?").bind(actor).first();
  if(prior?.expires_at>now&&prior.attempts>=6)
    return response(429,{error:"Muitas tentativas. Tente novamente mais tarde."},cors);
  const row=await db.prepare("SELECT b.id,c.code_hash,p.code_hash AS pending_hash FROM pv_beneficiarios b LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id WHERE b.cpf_index=? AND b.situacao='ativo'").bind(idx).first();
  const hash=row?await accessCodeHash(env,idx,code):"";
  const allowed=!!row&&(equalHex(hash,row.code_hash)||equalHex(hash,row.pending_hash));
  if(!allowed){
    const attempts=prior?.expires_at>now?prior.attempts+1:1;
    await db.prepare("INSERT INTO pv_space_attempts(actor_hash,attempts,expires_at) VALUES(?,?,?) ON CONFLICT(actor_hash) DO UPDATE SET attempts=excluded.attempts,expires_at=excluded.expires_at")
      .bind(actor,attempts,now+900).run();
    return response(401,{error:"CPF ou código não autorizado."},cors);
  }
  await db.prepare("DELETE FROM pv_space_attempts WHERE actor_hash=?").bind(actor).run();
  const bearer=randomToken();
  const tokenHash=await sha("pv-space-session|"+bearer+"|"+setting(env,"TELESAUDE_V3_SYNC_TOKEN"));
  await db.prepare("INSERT INTO pv_space_sessions(token_hash,beneficiario_id,code_hash,expires_at) VALUES(?,?,?,?)")
    .bind(tokenHash,row.id,hash,now+SESSION_SECONDS).run();
  return response(200,{token:bearer,expira_em_segundos:SESSION_SECONDS},cors);
}
async function identity(request,env){
  const bearer=(request.headers.get("Authorization")||"").match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!bearer)return null;
  const hash=await sha("pv-space-session|"+bearer+"|"+setting(env,"TELESAUDE_V3_SYNC_TOKEN"));
  const row=await env.PROMOVIE_BENEFICIARIOS_DB.prepare(
    "SELECT s.beneficiario_id,s.code_hash,b.situacao,c.code_hash AS current_hash,p.code_hash AS pending_hash FROM pv_space_sessions s "+
    "JOIN pv_beneficiarios b ON b.id=s.beneficiario_id "+
    "LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id "+
    "LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id "+
    "WHERE s.token_hash=? AND s.expires_at>?"
  ).bind(hash,Math.floor(Date.now()/1000)).first();
  if(!row||row.situacao!=="ativo"||
    !(equalHex(row.code_hash,row.current_hash)||equalHex(row.code_hash,row.pending_hash)))return null;
  return {owner:row.beneficiario_id,tokenHash:hash};
}
function envelope(data){
  if(!data||typeof data!=="object"||!Number.isSafeInteger(data.revision)||data.revision<0)return null;
  for(const field of ["salt","iv","ciphertext"]){
    if(typeof data[field]!=="string"||!/^[A-Za-z0-9_-]+$/.test(data[field]))return null;
  }
  if(data.salt.length!==22||data.iv.length!==16||data.ciphertext.length<24||
     data.ciphertext.length>MAX_VAULT_CIPHER)return null;
  return data;
}
function validDocument(data){
  return data&&typeof data==="object"&&
    typeof data.id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)&&
    typeof data.ciphertext==="string"&&data.ciphertext.length>=24&&
    data.ciphertext.length<=MAX_FILE_CIPHER&&/^[A-Za-z0-9_-]+$/.test(data.ciphertext);
}
export async function handleHealthSpace(request,env,cors={}){
  if(!originOK(request,env))return response(403,{error:"Origem não autorizada."},cors);
  const {pathname}=new URL(request.url),method=request.method;
  if(pathname===BASE+"/health"&&method==="GET")
    return response(200,{disponivel:enabled(env),limite_anexos:MAX_FILES,limite_anexo_kb:500},cors);
  if(!enabled(env))return response(503,{error:"Meu Espaço de Saúde ainda não está disponível."},cors);
  try{
    await setup(env);
    if(pathname===BASE+"/session"&&method==="POST")return login(request,env,cors);
    const user=await identity(request,env);
    if(!user)return response(401,{error:"Sessão encerrada. Entre novamente."},cors);
    const db=env.PROMOVIE_BENEFICIARIOS_DB;
    if(pathname===BASE+"/logout"&&method==="POST"){
      await db.prepare("DELETE FROM pv_space_sessions WHERE token_hash=?").bind(user.tokenHash).run();
      return response(200,{ok:true},cors);
    }
    if(pathname===BASE+"/vault"&&method==="GET"){
      const row=await db.prepare("SELECT revision,salt,iv,ciphertext,updated_at FROM pv_space_vaults WHERE beneficiario_id=?").bind(user.owner).first();
      return response(200,{revision:row?.revision||0,record:row||null},cors);
    }
    if(pathname===BASE+"/vault"&&method==="PUT"){
      const data=envelope(await jsonBody(request,MAX_VAULT_CIPHER+1024));
      if(!data)return response(400,{error:"Conteúdo criptografado inválido."},cors);
      const now=new Date().toISOString();
      if(data.revision===0){
        if(data.consent!==true)return response(403,{error:"Leia e aceite o aviso de privacidade para criar seu espaço."},cors);
        await db.prepare("INSERT OR IGNORE INTO pv_space_consents(beneficiario_id,accepted_at,policy_version) VALUES(?,?,'1')")
          .bind(user.owner,now).run();
        const result=await db.prepare("INSERT OR IGNORE INTO pv_space_vaults(beneficiario_id,revision,salt,iv,ciphertext,updated_at) VALUES(?,1,?,?,?,?)")
          .bind(user.owner,data.salt,data.iv,data.ciphertext,now).run();
        if(result.meta?.changes!==1)return response(409,{error:"Dados atualizados em outra sessão. Recarregue."},cors);
      }else{
        const result=await db.prepare("UPDATE pv_space_vaults SET revision=revision+1,iv=?,ciphertext=?,updated_at=? WHERE beneficiario_id=? AND revision=? AND salt=?")
          .bind(data.iv,data.ciphertext,now,user.owner,data.revision,data.salt).run();
        if(result.meta?.changes!==1)return response(409,{error:"Dados atualizados em outra sessão. Recarregue."},cors);
      }
      return response(200,{revision:data.revision+1,atualizado_em:now},cors);
    }
    if(pathname===BASE+"/documents"&&method==="POST"){
      const data=await jsonBody(request,MAX_FILE_CIPHER+1024);
      if(!validDocument(data))return response(400,{error:"Arquivo criptografado inválido ou muito grande."},cors);
      const total=await db.prepare("SELECT COUNT(*) AS total FROM pv_space_documents WHERE beneficiario_id=?").bind(user.owner).first();
      if(Number(total?.total)>=MAX_FILES)return response(413,{error:"Limite de documentos atingido."},cors);
      const bytes=Math.floor(data.ciphertext.length*3/4);
      const result=await db.prepare("INSERT OR IGNORE INTO pv_space_documents(id,beneficiario_id,ciphertext,bytes,created_at) VALUES(?,?,?,?,?)")
        .bind(data.id,user.owner,data.ciphertext,bytes,new Date().toISOString()).run();
      if(result.meta?.changes!==1)return response(409,{error:"Documento já existe."},cors);
      return response(201,{id:data.id,bytes},cors);
    }
    const match=pathname.match(/^\/api\/promovie\/space\/v1\/documents\/([0-9a-f-]{36})$/i);
    if(match){
      const id=match[1];
      if(method==="GET"){
        const row=await db.prepare("SELECT ciphertext FROM pv_space_documents WHERE id=? AND beneficiario_id=?").bind(id,user.owner).first();
        return row?response(200,{ciphertext:row.ciphertext},cors):response(404,{error:"Documento não encontrado."},cors);
      }
      if(method==="DELETE"){
        await db.prepare("DELETE FROM pv_space_documents WHERE id=? AND beneficiario_id=?").bind(id,user.owner).run();
        return response(200,{ok:true},cors);
      }
    }
    if(pathname===BASE+"/vault"&&method==="DELETE"){
      // Mesmo com uma sessão roubada, a exclusão requer novamente o código pessoal.
      const input=await jsonBody(request,2048);
      const code=String(input.codigo??"").trim().toUpperCase().replace(/[\s-]/g,"");
      if(!/^[A-HJ-NP-Z2-9]{20}$/.test(code))
        return response(403,{error:"Confirme o código pessoal para excluir seu espaço."},cors);
      const current=await db.prepare(
        "SELECT b.cpf_index,c.code_hash AS current_hash,p.code_hash AS pending_hash "+
        "FROM pv_beneficiarios b LEFT JOIN pv_access_codes c ON c.beneficiario_id=b.id "+
        "LEFT JOIN pv_access_codes_pending p ON p.beneficiario_id=b.id "+
        "WHERE b.id=? AND b.situacao='ativo'"
      ).bind(user.owner).first();
      const signed=current?await accessCodeHash(env,current.cpf_index,code):"";
      if(!current||!(equalHex(signed,current.current_hash)||equalHex(signed,current.pending_hash)))
        return response(403,{error:"Código pessoal incorreto. Nenhum dado foi excluído."},cors);
      await db.prepare("DELETE FROM pv_space_documents WHERE beneficiario_id=?").bind(user.owner).run();
      await db.prepare("DELETE FROM pv_space_vaults WHERE beneficiario_id=?").bind(user.owner).run();
      await db.prepare("DELETE FROM pv_space_consents WHERE beneficiario_id=?").bind(user.owner).run();
      await db.prepare("DELETE FROM pv_space_sessions WHERE beneficiario_id=?").bind(user.owner).run();
      return response(200,{ok:true},cors);
    }
    return response(404,{error:"Rota inexistente."},cors);
  }catch(e){
    if([400,413,415].includes(e?.status))return response(e.status,{error:"Solicitação inválida."},cors);
    return response(503,{error:"Não foi possível concluir esta operação com segurança."},cors);
  }
}
