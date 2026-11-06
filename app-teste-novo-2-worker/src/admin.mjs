// Painel privado PromoVie | Cloudflare D1.
// Cadastro administrativo não é prontuário. Não armazenar dados clínicos.
import {sendAccessEmail} from './access-email.mjs';
const PREFIX='/api/promovie/admin/v1';
const COOKIE='__Host-pv_admin';
const SESSION_TTL=60*60; // 1 hora
const MAX_BODY=4096;
const enc=new TextEncoder();
const dec=new TextDecoder();

function val(env,k){return typeof env[k]==='string'?env[k].trim():'';}
function reply(code,data,headers={}){
  return new Response(JSON.stringify(data),{status:code,headers:{
    'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers
  }});
}
function available(env){
  return !!env.PROMOVIE_BENEFICIARIOS_DB?.prepare &&
    val(env,'PROMOVIE_ADMIN_PASSWORD').length>=16 &&
    val(env,'PROMOVIE_ADMIN_DATA_KEY').length>=32 &&
    val(env,'TELESAUDE_V3_SYNC_TOKEN').length>=24;
}
function d1(env){return env.PROMOVIE_BENEFICIARIOS_DB;}

let schemaReady=false;
async function ensureSchema(env){
  if(schemaReady)return;
  const db=d1(env);
  // D1 exec exige uma instrução SQL por linha.
  // A inicialização não altera nenhum registro de paciente existente.
  const commands=[
    "CREATE TABLE IF NOT EXISTS pv_admin_sessions ("+
      "token_hash TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL);",
    "CREATE INDEX IF NOT EXISTS idx_pv_sessions_exp ON pv_admin_sessions(expires_at);",
    "CREATE TABLE IF NOT EXISTS pv_admin_login_attempts ("+
      "actor_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL);",
    "CREATE TABLE IF NOT EXISTS pv_beneficiarios ("+
      "id TEXT PRIMARY KEY, cpf_index TEXT NOT NULL UNIQUE, cpf_hint TEXT NOT NULL,"+
      "dados_criptografados TEXT NOT NULL, situacao TEXT NOT NULL DEFAULT 'rascunho'"+
      " CHECK(situacao IN ('rascunho','enviado','ativo','arquivado')),"+
      "situacao_anterior TEXT, plano TEXT NOT NULL DEFAULT '345', criado_em TEXT NOT NULL,"+
      "atualizado_em TEXT NOT NULL, enviado_em TEXT, arquivado_em TEXT);",
    "CREATE INDEX IF NOT EXISTS idx_pv_beneficiarios_situacao ON pv_beneficiarios(situacao);",
    "CREATE TABLE IF NOT EXISTS pv_historico ("+
      "id TEXT PRIMARY KEY, beneficiario_id TEXT NOT NULL, evento TEXT NOT NULL,"+
      "registrado_em TEXT NOT NULL, detalhes TEXT,"+
      "FOREIGN KEY (beneficiario_id) REFERENCES pv_beneficiarios(id));",
    "CREATE INDEX IF NOT EXISTS idx_pv_historico_ref ON pv_historico(beneficiario_id,registrado_em);"
  ];
  await db.exec(commands.join('\n'));
  schemaReady=true;
}

function originAllowed(request,env){
  const o=request.headers.get('Origin')||'';
  return val(env,'ALLOWED_ORIGINS').split(',').map(s=>s.trim()).includes(o);
}
function digits(x){return String(x??'').replace(/\D/g,'');}
function validCPF(cpf){
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
  for(let n=9;n<=10;n++){
    let sum=0;for(let i=0;i<n;i++)sum+=Number(cpf[i])*(n+1-i);
    let digit=(sum*10)%11;if(digit===10)digit=0;
    if(digit!==Number(cpf[n]))return false;
  }
  return true;
}
function validateData(body){
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  const cpf=digits(body.cpf),nome=String(body.nome??'').trim().replace(/\s+/g,' ');
  const email=String(body.email??'').trim(),telefone=digits(body.telefone);
  if(!validCPF(cpf)||nome.length<3||nome.length>100||!nome.includes(' ')||
    /[<>]/.test(nome)||email.length>180||
    (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||
    (telefone&&![10,11].includes(telefone.length)))return null;
  return {cpf,nome,email,telefone};
}
async function bodyJSON(request){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
    throw {status:415};
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)throw {status:413};
  const raw=await request.text();if(enc.encode(raw).length>MAX_BODY)throw {status:413};
  try{return JSON.parse(raw);}catch{throw {status:400};}
}
async function digestHex(input){
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(input)))]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function equals(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!b||a.length>256)return false;
  const [x,y]=await Promise.all([digestHex(a),digestHex(b)]);
  let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);
  return diff===0;
}
function b64(bytes){
  let v='';for(const c of bytes)v+=String.fromCharCode(c);
  return btoa(v).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function unb64(s){
  const str=atob(s.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(str,c=>c.charCodeAt(0));
}
async function dataKey(env){
  const bits=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|Dados|v1|'+val(env,'PROMOVIE_ADMIN_DATA_KEY')));
  return crypto.subtle.importKey('raw',bits,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
async function indexCPF(env,cpf){
  const hash=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|Indice|v1|'+val(env,'PROMOVIE_ADMIN_DATA_KEY')));
  const key=await crypto.subtle.importKey('raw',hash,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(cpf)))]
    .map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function encrypt(env,record){
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv},await dataKey(env),enc.encode(JSON.stringify(record))));
  return b64(iv)+'.'+b64(ciphertext);
}
async function decrypt(env,payload){
  const [iv,code]=payload.split('.');
  if(!iv||!code)throw Error('Corrupted payload');
  const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},
    await dataKey(env),unb64(code));
  return JSON.parse(dec.decode(result));
}
function tokenFromCookie(request){
  const v=request.headers.get('Cookie')||'';
  const match=v.match(/(?:^|;\s*)__Host-pv_admin=([A-Za-z0-9_-]{40,60})(?:;|$)/);
  return match?.[1]||'';
}
async function session(request,env){
  const t=tokenFromCookie(request);
  if(!t)return false;
  const hash=await digestHex('session|'+t+'|'+val(env,'TELESAUDE_V3_SYNC_TOKEN'));
  const row=await d1(env).prepare('SELECT token_hash FROM pv_admin_sessions WHERE token_hash=? AND expires_at>?')
    .bind(hash,Math.floor(Date.now()/1000)).first();
  return !!row;
}
function cookieHeader(value,maxAge){
  return COOKIE+'='+value+'; Path=/; Max-Age='+maxAge+'; Secure; HttpOnly; SameSite=Strict';
}
// Códigos pessoais separados da senha administrativa. A tabela e criada
// sob demanda sem alterar a estrutura nem os registros existentes.
let accessSchemaReady=false;
async function ensureAccessSchema(env){
  if(accessSchemaReady)return;
  const statements=[
    "CREATE TABLE IF NOT EXISTS pv_access_codes (beneficiario_id TEXT PRIMARY KEY, code_hash TEXT NOT NULL, criado_em TEXT NOT NULL, FOREIGN KEY(beneficiario_id) REFERENCES pv_beneficiarios(id));",
    "CREATE TABLE IF NOT EXISTS pv_access_attempts (actor_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);"
  ];
  await d1(env).exec(statements.join('\n'));
  accessSchemaReady=true;
}
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newPersonalCode(){
  const random=crypto.getRandomValues(new Uint8Array(20));
  const value=[...random].map(x=>CODE_ALPHABET[x&31]).join('');
  return value.match(/.{1,5}/g).join('-');
}
function normalizeCode(x){
  return typeof x==='string'?x.trim().toUpperCase().replace(/[\s-]/g,''):'';
}
async function accessHash(env,cpfIndex,code){
  const pepper=await crypto.subtle.digest('SHA-256',enc.encode('PromoVie|CodigoAcesso|v1|'+val(env,'PROMOVIE_ADMIN_DATA_KEY')));
  const hmacKey=await crypto.subtle.importKey('raw',pepper,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',hmacKey,enc.encode(cpfIndex+'|'+code));
  return [...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function accessConfigured(env){
  return available(env)&&val(env,'PROMOVIE_BENEFICIARY_ACCESS_ENABLED')==='true'&&
    val(env,'WIDGET_ENVIRONMENT')==='production'&&
    val(env,'MEDIQUO_V3_PLAN')==='345'&&
    !!sdkBase(env)&&
    !!val(env,'MEDIQUO_V3_WIDGET_API_KEY')&&
    !!val(env,'MEDIQUO_V3_SDK_SECRET_KEY');
}
async function unsuccessfulAccess(db,actorHash,attempts,expiresAt){
  await db.prepare('INSERT INTO pv_access_attempts(actor_hash,attempts,expires_at) VALUES(?,?,?) ON CONFLICT(actor_hash) DO UPDATE SET attempts=excluded.attempts,expires_at=excluded.expires_at')
    .bind(actorHash,attempts,expiresAt).run();
}
export async function handleBeneficiaryAccess(request,env,cors={}){
  const path=new URL(request.url).pathname,method=request.method;
  const base='/api/promovie/access/v1';
  // Origem explicita obrigatoria: nao aceitar invocacoes de outros sites.
  if(!originAllowed(request,env))return reply(403,{error:'Origem não autorizada.'},cors);
  if(path===base+'/health'&&method==='GET')
    return reply(200,{disponivel:accessConfigured(env)},cors);
  if(path!==base+'/session'||method!=='POST')return reply(404,{error:'Rota inexistente.'},cors);
  if(!accessConfigured(env))return reply(503,{error:'O acesso ao atendimento ainda não está liberado.'},cors);
  try{
    const input=await bodyJSON(request);
    const cpf=digits(input?.cpf),code=normalizeCode(input?.codigo);
    if(!validCPF(cpf)||!new RegExp('^['+CODE_ALPHABET+']{20}$').test(code))
      return reply(401,{error:'CPF ou código de acesso não autorizado.'},cors);
    await ensureAccessSchema(env);
    const idx=await indexCPF(env,cpf);
    const db=d1(env),actor=await digestHex('pv-access-attempt|'+idx+'|'+val(env,'TELESAUDE_V3_SYNC_TOKEN'));
    const now=Math.floor(Date.now()/1000);
    const previous=await db.prepare('SELECT attempts,expires_at FROM pv_access_attempts WHERE actor_hash=?')
      .bind(actor).first();
    if(previous?.expires_at>now&&previous.attempts>=6)
      return reply(429,{error:'Acesso temporariamente bloqueado após várias tentativas. Tente mais tarde.'},cors);
    const record=await db.prepare("SELECT b.id,c.code_hash FROM pv_beneficiarios b JOIN pv_access_codes c ON c.beneficiario_id=b.id WHERE b.cpf_index=? AND b.situacao='ativo'")
      .bind(idx).first();
    const match=record&&await equals(await accessHash(env,idx,code),record.code_hash);
    if(!match){
      const attempts=previous?.expires_at>now?previous.attempts+1:1;
      await unsuccessfulAccess(db,actor,attempts,now+900);
      return reply(401,{error:'CPF ou código de acesso não autorizado.'},cors);
    }
    // Revalidar com o fornecedor antes de emitir token, inclusive para licenças suspensas.
    const found=await sdk(env,'GET','/patients/'+encodeURIComponent(cpf));
    if(!found.ok){
      if(found.status===404)return reply(403,{error:'Cadastro sem acesso ativo. Procure a PromoVie.'},cors);
      return reply(502,{error:'Não foi possível validar a situação do atendimento.'},cors);
    }
    const patient=patientFromSDK(found.data);
    if(!patient||patient.active===false||patient.unsubscribed_at||
       String(patient.plan)!=='345'||patient.code!==undefined&&digits(patient.code)!==cpf)
      return reply(403,{error:'Cadastro sem acesso ativo. Procure a PromoVie.'},cors);
    const auth=await sdk(env,'POST','/patients/authenticate?code='+encodeURIComponent(cpf));
    const token=auth.data?.access_token||auth.data?.data?.access_token;
    if(!auth.ok||typeof token!=='string'||!token)
      return reply(502,{error:'Não foi possível iniciar o atendimento agora.'},cors);
    await db.prepare('DELETE FROM pv_access_attempts WHERE actor_hash=?').bind(actor).run();
    return reply(200,{access_token:token,apiKey:val(env,'MEDIQUO_V3_WIDGET_API_KEY'),environment:'production'},cors);
  }catch(e){
    const status=[400,413,415].includes(e?.status)?e.status:502;
    return reply(status,{error:'Não foi possível concluir a autenticação.'},cors);
  }
}

async function appendLog(db,id,event,detail=''){
  await db.prepare('INSERT INTO pv_historico(id,beneficiario_id,evento,registrado_em,detalhes) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),id,event,new Date().toISOString(),detail).run();
}
async function attemptKey(request,env){
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  return digestHex('ip|'+ip+'|'+val(env,'TELESAUDE_V3_SYNC_TOKEN'));
}
async function login(request,env,cors,obj){
  const db=d1(env),key=await attemptKey(request,env);
  const now=Math.floor(Date.now()/1000);
  const attempt=await db.prepare('SELECT attempts,expires_at FROM pv_admin_login_attempts WHERE actor_hash=?')
    .bind(key).first();
  if(attempt&&attempt.expires_at>now&&attempt.attempts>=6)
    return reply(429,{error:'Muitas tentativas. Acesso temporariamente bloqueado.'},cors);
  if(!await equals(obj?.senha,val(env,'PROMOVIE_ADMIN_PASSWORD'))){
    const attempts=attempt?.expires_at>now?attempt.attempts+1:1;
    await db.prepare('INSERT INTO pv_admin_login_attempts(actor_hash,attempts,expires_at) VALUES(?,?,?) ON CONFLICT(actor_hash) DO UPDATE SET attempts=excluded.attempts,expires_at=excluded.expires_at')
      .bind(key,attempts,now+900).run();
    return reply(401,{error:'Senha administrativa incorreta.'},cors);
  }
  await db.prepare('DELETE FROM pv_admin_login_attempts WHERE actor_hash=?').bind(key).run();
  const token=b64(crypto.getRandomValues(new Uint8Array(32)));
  const hash=await digestHex('session|'+token+'|'+val(env,'TELESAUDE_V3_SYNC_TOKEN'));
  await db.prepare('INSERT INTO pv_admin_sessions(token_hash,created_at,expires_at) VALUES(?,?,?)')
    .bind(hash,new Date().toISOString(),now+SESSION_TTL).run();
  return reply(200,{ok:true,expira_em_segundos:SESSION_TTL},
    {...cors,'Set-Cookie':cookieHeader(token,SESSION_TTL)});
}
function sdkBase(env){
  try{
    const u=new URL(val(env,'MEDIQUO_V3_BASE_URL'));
    if(u.protocol!=='https:'||u.hostname!=='sdk.mediquo.com'||
      u.pathname.replace(/\/+$/,'')!=='/v1'||u.port||u.username||u.password||u.hash||u.search)return '';
    return u.href.replace(/\/+$/,'');
  }catch{return '';}
}
async function sdk(env,verb,path,body){
  if(!sdkBase(env)||!val(env,'MEDIQUO_V3_WIDGET_API_KEY')||!val(env,'MEDIQUO_V3_SDK_SECRET_KEY'))return {ok:false,status:503};
  const resp=await fetch(sdkBase(env)+path,{
    method:verb,headers:{'Content-Type':'application/json',
      'X-API-Key':val(env,'MEDIQUO_V3_WIDGET_API_KEY'),
      'X-Secret-Key':val(env,'MEDIQUO_V3_SDK_SECRET_KEY')},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)
  });
  if(!resp.ok)return {ok:false,status:resp.status};
  if(verb==='PUT')return {ok:true,status:resp.status};
  try{return {ok:true,data:await resp.json(),status:resp.status};}
  catch{return {ok:false,status:502};}
}
function patientFromSDK(data){
  const p=data?.data?.patient||data?.data||data?.patient||data;
  return p&&typeof p==='object'&&!Array.isArray(p)?p:null;
}
function safeRow(row,item,detail=false){
  return {id:row.id,nome:item.nome,
    cpf:detail?item.cpf:('***.***.***-'+item.cpf.slice(-2)),
    email:detail?item.email:null,telefone:detail?item.telefone:null,
    situacao:row.situacao,plano:row.plano,
    criado_em:row.criado_em,atualizado_em:row.atualizado_em,
    enviado_em:row.enviado_em,arquivado_em:row.arquivado_em};
}
async function oneRecord(env,id){
  const row=await d1(env).prepare('SELECT * FROM pv_beneficiarios WHERE id=?').bind(id).first();
  return row?{row,item:await decrypt(env,row.dados_criptografados)}:null;
}
export async function handleAdmin(request,env,cors={}){
  const path=new URL(request.url).pathname;
  const method=request.method;
  const baseCors={...cors,'Access-Control-Allow-Credentials':'true'};
  // Nunca atender requisições de alteração sem origem explícita e autorizada.
  if(method!=='GET'&&!originAllowed(request,env))
    return reply(403,{error:'Origem administrativa não autorizada.'},baseCors);
  if(!available(env))return reply(503,{error:'Painel ainda não configurado. É necessário associar o banco D1 e definir as duas credenciais administrativas.'},baseCors);
  if(path===PREFIX+'/health'&&method==='GET'){
    try{
      const ok=await d1(env).prepare('SELECT 1 AS ok').first();
      if(ok?.ok!==1)throw Error('D1 falhou');
      return reply(200,{ok:true,banco:'conectado',credenciais:'configuradas',cadastro_real_habilitado:val(env,'TELESAUDE_V3_WRITE_ENABLED')==='true'},baseCors);
    }catch{
      return reply(503,{ok:false,error:'Banco administrativo indisponível.'},baseCors);
    }
  }
  if(!tokenFromCookie(request) && method==='GET'){
    return reply(401,{error:'Faça login para acessar o painel.'},baseCors);
  }

  try{
    if(path===PREFIX+'/login'&&method==='POST'){
      const obj=await bodyJSON(request);
      // Inicializa tabelas mesmo antes de uma primeira tentativa incorreta,
      // evitando falha 500 quando a senha de acesso ainda não foi validada.
      await ensureSchema(env);
      return login(request,env,baseCors,obj);
    }
    if(!(await session(request,env)))return reply(401,{error:'Faça login para acessar o painel.'},baseCors);
    const db=d1(env),url=new URL(request.url);
    if(path===PREFIX+'/me'&&method==='GET')return reply(200,{ok:true},baseCors);
    if(path===PREFIX+'/logout'&&method==='POST'){
      const t=tokenFromCookie(request);
      if(t){
        const hash=await digestHex('session|'+t+'|'+val(env,'TELESAUDE_V3_SYNC_TOKEN'));
        await db.prepare('DELETE FROM pv_admin_sessions WHERE token_hash=?').bind(hash).run();
      }
      return reply(200,{ok:true},{...baseCors,'Set-Cookie':cookieHeader('',0)});
    }
    if(path===PREFIX+'/records'&&method==='GET'){
      const page=Math.max(0,Math.min(1000,parseInt(url.searchParams.get('page')||'0',10)||0));
      const limit=50;
      const dbRows=await db.prepare('SELECT * FROM pv_beneficiarios ORDER BY criado_em DESC LIMIT ? OFFSET ?')
        .bind(limit+1,page*limit).all();
      const rows=dbRows.results||[];
      const records=await Promise.all(rows.slice(0,limit).map(async r=>safeRow(r,await decrypt(env,r.dados_criptografados))));
      return reply(200,{registros:records,pagina:page,mais:rows.length>limit},baseCors);
    }
    if(path===PREFIX+'/records'&&method==='POST'){
      const data=validateData(await bodyJSON(request));
      if(!data)return reply(400,{error:'Verifique CPF, nome completo e contatos.'},baseCors);
      const idx=await indexCPF(env,data.cpf);
      const exists=await db.prepare('SELECT id FROM pv_beneficiarios WHERE cpf_index=?').bind(idx).first();
      if(exists)return reply(409,{error:'Esse CPF já está cadastrado no arquivo da PromoVie.'},baseCors);
      const id=crypto.randomUUID(),now=new Date().toISOString();
      const encrypted=await encrypt(env,data);
      await db.prepare('INSERT INTO pv_beneficiarios(id,cpf_index,cpf_hint,dados_criptografados,situacao,plano,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?)')
        .bind(id,idx,data.cpf.slice(-2),encrypted,'rascunho','345',now,now).run();
      await appendLog(db,id,'cadastro_local','Registro criado sem consumo de licença');
      return reply(201,{ok:true,id,situacao:'rascunho'},baseCors);
    }
    const match=path.match(/^\/api\/promovie\/admin\/v1\/records\/([a-f0-9-]{36})(?:\/(verify|send|archive|restore|history|access-code|revoke-access))?$/);
    if(!match)return reply(404,{error:'Rota inexistente.'},baseCors);
    const rec=await oneRecord(env,match[1]);if(!rec)return reply(404,{error:'Beneficiário não encontrado.'},baseCors);
    const {row,item}=rec,action=match[2];
    if(method==='GET'&&!action)return reply(200,{registro:safeRow(row,item,true)},baseCors);
    if(method==='GET'&&action==='history'){
      const logs=await db.prepare('SELECT evento,registrado_em,detalhes FROM pv_historico WHERE beneficiario_id=? ORDER BY registrado_em DESC LIMIT 100')
        .bind(row.id).all();
      return reply(200,{historico:logs.results||[]},baseCors);
    }
    if(method==='POST'&&(action==='access-code'||action==='revoke-access')){
      if(row.situacao!=='ativo')return reply(409,{error:'Somente beneficiários ativos podem receber ou revogar um código pessoal.'},baseCors);
      await ensureAccessSchema(env);
      if(action==='revoke-access'){
        await db.prepare('DELETE FROM pv_access_codes WHERE beneficiario_id=?').bind(row.id).run();
        await appendLog(db,row.id,'codigo_revogado','Acesso pessoal revogado pela administração');
        return reply(200,{ok:true,informacao:'Código pessoal revogado. O beneficiário não poderá iniciar novas sessões.'},baseCors);
      }
      // Um código novo invalida imediatamente o anterior. Somente exibido nesta resposta HTTPS.
      const code=newPersonalCode();
      const hash=await accessHash(env,row.cpf_index,normalizeCode(code));
      const now=new Date().toISOString();
      await db.prepare('INSERT INTO pv_access_codes(beneficiario_id,code_hash,criado_em) VALUES(?,?,?) ON CONFLICT(beneficiario_id) DO UPDATE SET code_hash=excluded.code_hash,criado_em=excluded.criado_em')
        .bind(row.id,hash,now).run();
      await appendLog(db,row.id,'codigo_gerado','Código pessoal criado sem armazenar o valor em texto');
      // Serviço externo é opcional. Se desativado ou indisponível, a entrega manual continua igual.
      const entregaEmail=await sendAccessEmail(env,{
        email:item.email,nome:item.nome,codigo:code,recordId:row.id
      });
      if(entregaEmail==='aceito')await appendLog(db,row.id,'email_codigo_aceito','Serviço de e-mail aceitou a solicitação de envio (entrega não confirmada)');
      return reply(200,{ok:true,codigo:code,entrega_email:entregaEmail,
        informacao:'Código pessoal gerado. Copie e entregue ao beneficiário de modo seguro. Ele não será exibido novamente.'},baseCors);
    }
    if(method==='POST'&&action==='archive'&&row.situacao!=='arquivado'){
      await db.prepare('UPDATE pv_beneficiarios SET situacao_anterior=?,situacao=?,arquivado_em=?,atualizado_em=? WHERE id=?')
        .bind(row.situacao,'arquivado',new Date().toISOString(),new Date().toISOString(),row.id).run();
      await appendLog(db,row.id,'arquivado','Somente arquivo local, sem suspender licença na Médiquo');
      return reply(200,{ok:true,explicacao:'Registro arquivado no painel. A licença do Token PromoVie NÃO foi suspensa.'},baseCors);
    }
    if(method==='POST'&&action==='restore'&&row.situacao==='arquivado'){
      const status=['rascunho','enviado','ativo'].includes(row.situacao_anterior)?row.situacao_anterior:'rascunho';
      await db.prepare('UPDATE pv_beneficiarios SET situacao=?,situacao_anterior=NULL,arquivado_em=NULL,atualizado_em=? WHERE id=?')
        .bind(status,new Date().toISOString(),row.id).run();
      await appendLog(db,row.id,'restaurado','Retorno ao arquivo ativo');
      return reply(200,{ok:true,situacao:status},baseCors);
    }
    if(method==='POST'&&action==='verify'){
      const r=await sdk(env,'GET','/patients/'+encodeURIComponent(item.cpf));
      if(r.status===404)return reply(200,{encontrado:false,informacao:'CPF ainda não encontrado no Token PromoVie.'},baseCors);
      if(!r.ok)return reply(502,{error:'A consulta ao Token PromoVie falhou.'},baseCors);
      const p=patientFromSDK(r.data);
      if(!p||p.code!==undefined&&digits(p.code)!==item.cpf)
        return reply(502,{error:'Dados inesperados na consulta ao Token PromoVie.'},baseCors);
      const ativo=p.active!==false&&!p.unsubscribed_at&&String(p.plan)==='345';
      if(row.situacao!=='arquivado'&&ativo){
        await db.prepare('UPDATE pv_beneficiarios SET situacao=?,atualizado_em=? WHERE id=?')
          .bind('ativo',new Date().toISOString(),row.id).run();
        await appendLog(db,row.id,'confirmado','Médiquo informou plano ativo 345');
      }
      return reply(200,{encontrado:true,ativo,plano:String(p.plan||'')},baseCors);
    }
    if(method==='POST'&&action==='send'){
      if(row.situacao==='arquivado')return reply(409,{error:'Restaure o registro antes de tentar cadastrar.'},baseCors);
      if(val(env,'TELESAUDE_V3_WRITE_ENABLED')!=='true')
        return reply(503,{error:'Envio real bloqueado até liberação controlada na Cloudflare.'},baseCors);
      if(item.cpf!==val(env,'TELESAUDE_V3_TEST_CPF') &&
         val(env,'PROMOVIE_ADMIN_MULTI_PATIENT_ENABLED')!=='true')
        return reply(403,{error:'Primeira ativação restrita ao CPF autorizado.'},baseCors);
      const exists=await sdk(env,'GET','/patients/'+encodeURIComponent(item.cpf));
      if(exists.ok)return reply(409,{error:'CPF já existe no Token PromoVie. Verifique o cadastro; nenhum novo registro foi enviado.'},baseCors);
      if(exists.status!==404)return reply(502,{error:'Não foi possível verificar duplicidade no Token PromoVie.'},baseCors);
      const names=item.nome.split(' ');
      const patient={code:item.cpf,tax_id:item.cpf,first_name:names.shift(),
        last_name:names.join(' '),plan:'345',locale:'pt'};
      if(item.email)patient.email=item.email;
      if(item.telefone)patient.phone=item.telefone;
      const sent=await sdk(env,'PUT','/patients',{patients:[patient]});
      if(!sent.ok)return reply(502,{error:'O Token PromoVie não confirmou o envio. Consulte antes de repetir.'},baseCors);
      const now=new Date().toISOString();
      await db.prepare('UPDATE pv_beneficiarios SET situacao=?,enviado_em=?,atualizado_em=? WHERE id=?')
        .bind('enviado',now,now,row.id).run();
      await appendLog(db,row.id,'enviado','Cadastro enviado ao SDK; aguardando confirmação da licença');
      return reply(202,{ok:true,informacao:'Cadastro enviado. Use Verificar para confirmar o plano ativo.'},baseCors);
    }
    return reply(405,{error:'Operação não permitida para a situação do registro.'},baseCors);
  }catch(e){
    const status=[400,413,415].includes(e?.status)?e.status:500;
    return reply(status,{error:status===500?'Não foi possível concluir a operação. Confira a configuração do banco D1.':'Requisição inválida.'},baseCors);
  }
}
