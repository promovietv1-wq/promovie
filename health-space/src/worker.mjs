import {enc,dec,b64,unb64,random,hash,hmac,equal,seal,open} from './crypto.mjs';
import {identity,stillAuthorized} from './identity.mjs';
export const BASE='/telesaude/meu-espaco';
const API=BASE+'/api',COOKIE='__Host-pv_health',CONSENT='2026-11-06-v1';
const MAX_FILE=5*1024*1024,MAX_TOTAL=50*1024*1024;
const now=()=>Math.floor(Date.now()/1000);
const sql=(env,q,...a)=>env.HEALTH_DB.prepare(q).bind(...a);
const fail=(status)=>{throw {status};};
const headers={ 'Cache-Control':'no-store, private, max-age=0','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cross-Origin-Resource-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow, noarchive'};
const response=(status,data,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
const cookie=(token,age=3600)=>`${COOKIE}=${token}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
function token(req){const matches=(req.headers.get('Cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+'='));if(matches.length!==1)return '';const t=matches[0].slice(COOKIE.length+1);return /^[A-Za-z0-9_-]{43}$/.test(t)?t:'';}
export function ready(env){try{return env.HEALTH_ENABLED==='true'&&env.HEALTH_REVIEW_APPROVED==='true'&&env.HEALTH_ORIGIN==='https://www.promovie.tv.br'&&env.HEALTH_DB?.prepare&&env.BENEFICIARIES?.prepare&&env.FILES?.put&&env.SCANNER?.fetch&&env.ASSETS?.fetch&&env.PROMOVIE_ADMIN_DATA_KEY?.length>=32&&unb64(env.HEALTH_AUDIT_KEY).length===32&&unb64(JSON.parse(env.HEALTH_KEYS)[env.HEALTH_KEY_VERSION]).length===32;}catch{return false;}}
export async function readBytes(req,limit){
  const declared=req.headers.get('Content-Length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>limit))fail(413);
  if(!req.body)return new Uint8Array();const reader=req.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
}
async function json(req,limit=65536){if(!/^application\/json(?:;|$)/i.test(req.headers.get('Content-Type')||''))fail(415);try{return JSON.parse(dec.decode(await readBytes(req,limit)));}catch(e){if(e.status)throw e;fail(400);}}
async function pseudonym(env,s){return hmac(unb64(env.HEALTH_AUDIT_KEY),s);}
async function limit(env,actor,max,seconds){
  const key=await pseudonym(env,actor),t=now();
  const r=await sql(env,'INSERT INTO health_limits(actor,count,expires) VALUES(?,1,?) ON CONFLICT(actor) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count',key,t+seconds,t,t).first();
  if(!r||r.count>max)fail(429);
}
async function audit(env,owner,event){await sql(env,'INSERT INTO health_audit(id,actor,event,at) VALUES(?,?,?,?)',crypto.randomUUID(),await pseudonym(env,owner),event,now()).run();}
async function session(req,env){
  const t=token(req);if(!t)fail(401);
  const s=await sql(env,'SELECT s.*,u.state FROM health_sessions s JOIN health_users u ON u.owner=s.owner WHERE s.hash=? AND s.expires>? AND s.idle>?',await hash(t),now(),now()).first();
  if(!s||!await stillAuthorized(env,s))fail(401);
  await limit(env,'user|'+s.owner,120,60);
  if(req.method!=='GET'&&!await equal(req.headers.get('X-CSRF-Token'),s.csrf))fail(403);
  await sql(env,'UPDATE health_sessions SET idle=? WHERE hash=?',Math.min(now()+900,s.expires),s.hash).run();return s;
}
export function validateRecord(input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400);
  const fields=['essenciais','alergias','medicamentos','anotacoes','perguntas'];
  if(Object.keys(input).some(k=>!fields.includes(k)))fail(400);
  const result={};for(const k of fields){if(typeof input[k]!=='string'||input[k].length>8000)fail(400);result[k]=input[k];}return result;
}
async function getRecord(env,owner){const r=await sql(env,'SELECT * FROM health_records WHERE owner=?',owner).first();return r?{data:JSON.parse(dec.decode(await open(env,owner,'record',r.encrypted))),version:r.version}:{data:{essenciais:'',alergias:'',medicamentos:'',anotacoes:'',perguntas:''},version:0};}
async function listFiles(env,owner){const {results}=await sql(env,"SELECT * FROM health_files WHERE owner=? AND state='ready' ORDER BY created DESC",owner).all();return Promise.all(results.map(async r=>({id:r.id,size:r.size,created:r.created,...JSON.parse(dec.decode(await open(env,owner,'meta|'+r.id,r.encrypted_metadata)))})));}
export function fileType(bytes){
  if(bytes.length>=5&&dec.decode(bytes.subarray(0,5))==='%PDF-')return 'application/pdf';
  if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return 'image/png';
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';fail(415);
}
async function removeFile(env,owner,id){
  const r=await sql(env,'UPDATE health_files SET state=\'deleting\' WHERE owner=? AND id=? RETURNING object_key',owner,id).first();if(!r)fail(404);
  await env.FILES.delete(r.object_key);await sql(env,'DELETE FROM health_files WHERE owner=? AND id=?',owner,id).run();
}
async function erase(env,owner){
  await sql(env,"UPDATE health_users SET state='deleting' WHERE owner=?",owner).run();
  const {results}=await sql(env,'SELECT id FROM health_files WHERE owner=?',owner).all();
  for(const r of results)await removeFile(env,owner,r.id);
  await env.HEALTH_DB.batch([
    sql(env,'DELETE FROM health_sessions WHERE owner=?',owner),sql(env,'DELETE FROM health_records WHERE owner=?',owner),sql(env,'DELETE FROM health_users WHERE owner=?',owner)
  ]);
  await audit(env,owner,'erase');
}
async function api(req,env,path){
  // Require exact origin even for reads: no CORS, no wildcard, no missing Origin.
  const origin=req.headers.get('Origin');
  const sameOriginRead=req.method==='GET'&&!origin&&req.headers.get('Sec-Fetch-Site')==='same-origin';
  if((origin!==env.HEALTH_ORIGIN&&!sameOriginRead)||req.headers.get('Sec-Fetch-Site')==='cross-site'||req.headers.get('X-Health-Request')!=='1')fail(403);
  if(path==='/session'&&req.method==='POST'){
    await limit(env,'login-ip|'+(req.headers.get('CF-Connecting-IP')||'unknown'),15,900);
    const input=await json(req,1024);
    await limit(env,'login-cpf|'+String(input?.cpf||'').replace(/\D/g,''),6,900);
    if(input?.consent!==CONSENT)fail(400);
    const who=await identity(env,input.cpf,input.codigo);if(!who)fail(401);
    const t=random(),csrf=random(),time=now();
    // One session per beneficiary, replacing a stolen/old browser session.
    await env.HEALTH_DB.batch([
      sql(env,"INSERT INTO health_users(owner,consent_at,consent_version) VALUES(?,?,?) ON CONFLICT(owner) DO NOTHING",who.owner,time,CONSENT),
      sql(env,'DELETE FROM health_sessions WHERE owner=?',who.owner),
      sql(env,'INSERT INTO health_sessions(hash,owner,credential_hash,csrf,expires,idle,created) VALUES(?,?,?,?,?,?,?)',await hash(t),who.owner,who.credential,csrf,time+3600,time+900,time)
    ]);
    await audit(env,who.owner,'login');return response(200,{csrf,expires:time+3600},{'Set-Cookie':cookie(t)});
  }
  const s=await session(req,env);
  if(path==='/session'&&req.method==='DELETE'){
    await sql(env,'DELETE FROM health_sessions WHERE hash=?',s.hash).run();return response(200,{ok:true},{'Set-Cookie':cookie('',0)});
  }
  if(path==='/space'&&req.method==='DELETE'){
    if(now()-s.created>300)fail(428);const input=await json(req,128);if(input?.confirm!=='EXCLUIR')fail(400);
    await erase(env,s.owner);return response(200,{ok:true},{'Set-Cookie':cookie('',0)});
  }
  if(s.state!=='active')fail(423);
  if(path==='/session'&&req.method==='GET')return response(200,{csrf:s.csrf,expires:s.expires});
  if(path==='/record'&&req.method==='GET')return response(200,await getRecord(env,s.owner));
  if(path==='/record'&&req.method==='PUT'){
    const input=await json(req),data=validateRecord(input?.data);if(!Number.isSafeInteger(input.version)||input.version<0)fail(400);
    const ciphertext=await seal(env,s.owner,'record',enc.encode(JSON.stringify(data)));
    const r=await sql(env,"INSERT INTO health_records(owner,encrypted,version,updated) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM health_users WHERE owner=? AND state='active') AND (?=0 OR EXISTS(SELECT 1 FROM health_records WHERE owner=?)) ON CONFLICT(owner) DO UPDATE SET encrypted=excluded.encrypted,version=health_records.version+1,updated=excluded.updated WHERE health_records.version=? RETURNING version",s.owner,ciphertext,now(),s.owner,input.version,s.owner,input.version).first();
    if(!r)fail(409);await audit(env,s.owner,'save');return response(200,{version:r.version});
  }
  if(path==='/files'&&req.method==='GET')return response(200,{files:await listFiles(env,s.owner)});
  if(path==='/files'&&req.method==='POST'){
    await limit(env,'upload|'+s.owner,20,3600);
    const bytes=await readBytes(req,MAX_FILE);if(!bytes.length)fail(400);const mime=fileType(bytes);
    let name;try{name=decodeURIComponent(req.headers.get('X-File-Name')||'');}catch{fail(400);}
    if(!name||name.length>120||/[\x00-\x1f\x7f/\\]/.test(name))fail(400);
    const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg';
    if(!new RegExp('\\.'+(ext==='jpg'?'jpe?g':ext)+'$','i').test(name))fail(415);
    // Private scanner service must inspect complete file structure and malware.
    // Never send clinical documents to a public scanning API.
    const scan=await env.SCANNER.fetch('https://scanner.internal/scan',{method:'POST',headers:{'Content-Type':mime},body:bytes,signal:AbortSignal.timeout(20000)});
    if(!scan.ok||(await scan.json()).clean!==true)fail(422);
    const id=crypto.randomUUID(),key=crypto.randomUUID(),created=now();
    const meta=await seal(env,s.owner,'meta|'+id,enc.encode(JSON.stringify({name,mime})));
    const reserved=await sql(env,"INSERT INTO health_files(id,owner,object_key,encrypted_metadata,size,state,created) SELECT ?,?,?,?,?,'pending',? WHERE EXISTS(SELECT 1 FROM health_users WHERE owner=? AND state='active') AND (SELECT COUNT(*) FROM health_files WHERE owner=?)<20 AND (SELECT COALESCE(SUM(size),0) FROM health_files WHERE owner=?)+?<=? RETURNING id",id,s.owner,key,meta,bytes.length,created,s.owner,s.owner,s.owner,bytes.length,MAX_TOTAL).first();
    if(!reserved)fail(409);
    await env.FILES.put(key,await seal(env,s.owner,'file|'+id,bytes),{httpMetadata:{contentType:'application/octet-stream'}});
    const saved=await sql(env,"UPDATE health_files SET state='ready' WHERE owner=? AND id=? AND state='pending' AND EXISTS(SELECT 1 FROM health_users WHERE owner=? AND state='active') RETURNING id",s.owner,id,s.owner).first();
    if(!saved){await env.FILES.delete(key);fail(409);}
    await audit(env,s.owner,'upload');return response(201,{id});
  }
  const match=path.match(/^\/files\/([0-9a-f-]{36})$/);
  if(match&&req.method==='DELETE'){await removeFile(env,s.owner,match[1]);await audit(env,s.owner,'delete-file');return response(200,{ok:true});}
  if(match&&req.method==='GET'){
    const r=await sql(env,"SELECT * FROM health_files WHERE owner=? AND id=? AND state='ready'",s.owner,match[1]).first();if(!r)fail(404);
    const object=await env.FILES.get(r.object_key);if(!object)fail(503);
    const bytes=await open(env,s.owner,'file|'+r.id,await object.text());
    const meta=JSON.parse(dec.decode(await open(env,s.owner,'meta|'+r.id,r.encrypted_metadata)));
    await audit(env,s.owner,'download');
    return new Response(bytes,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename=\"documento\"; filename*=UTF-8''"+encodeURIComponent(meta.name)}});
  }
  if(path==='/export'&&req.method==='POST'){
    if(now()-s.created>300)fail(428);await limit(env,'export|'+s.owner,3,3600);
    const record=await getRecord(env,s.owner);
    const {results}=await sql(env,"SELECT * FROM health_files WHERE owner=? AND state='ready'",s.owner).all();
    await audit(env,s.owner,'export');let i=-1;
    const stream=new ReadableStream({async pull(controller){try{
      if(i===-1){i=0;controller.enqueue(enc.encode(JSON.stringify({type:'informacoes',...record})+'\n'));return;}
      if(i>=results.length){controller.close();return;}
      const r=results[i++],o=await env.FILES.get(r.object_key);if(!o)throw Error('missing');
      const meta=JSON.parse(dec.decode(await open(env,s.owner,'meta|'+r.id,r.encrypted_metadata)));
      controller.enqueue(enc.encode(JSON.stringify({type:'arquivo',...meta,base64:b64(await open(env,s.owner,'file|'+r.id,await o.text()))})+'\n'));
    }catch{controller.error(Error('Exportação incompleta. Tente novamente.'));}}});
    return new Response(stream,{headers:{...headers,'Content-Type':'application/x-ndjson','Content-Disposition':'attachment; filename="meu-espaco.ndjson"'}});
  }
  fail(404);
}
export async function cleanup(env){
  const {results:users}=await sql(env,"SELECT owner FROM health_users WHERE state='deleting' LIMIT 100").all();for(const u of users)await erase(env,u.owner);
  const {results:files}=await sql(env,"SELECT owner,id FROM health_files WHERE state='deleting' OR (state='pending' AND created<?) LIMIT 100",now()-3600).all();for(const f of files)await removeFile(env,f.owner,f.id);
  await env.HEALTH_DB.batch([sql(env,'DELETE FROM health_sessions WHERE expires<? OR idle<?',now(),now()),sql(env,'DELETE FROM health_limits WHERE expires<?',now()),sql(env,'DELETE FROM health_audit WHERE at<?',now()-90*86400)]);
  // Reconcile R2/D1 after a process crash between object write and DB commit.
  // Never delete a recent upload or any object still referenced by a row.
  let cursor;
  do {const page=await env.FILES.list({limit:1000,...(cursor?{cursor}:{})});
    for(const object of page.objects){if(new Date(object.uploaded).getTime()>Date.now()-86400000)continue;
      if(!await sql(env,'SELECT id FROM health_files WHERE object_key=?',object.key).first())await env.FILES.delete(object.key);
    }cursor=page.truncated?page.cursor:undefined;
  }while(cursor);
}
export default {
  async fetch(req,env){try{
    const url=new URL(req.url);
    if(!ready(env))return response(503,{error:'Espaço de Saúde ainda não disponível.'});
    if(url.origin!==env.HEALTH_ORIGIN||url.search)fail(400);
    if(url.pathname.startsWith(API+'/'))return await api(req,env,url.pathname.slice(API.length));
    const allowed=new Set([BASE+'/',BASE+'/index.html',BASE+'/app.js',BASE+'/style.css',BASE+'/heart.webp']);
    if(!allowed.has(url.pathname)||!['GET','HEAD'].includes(req.method))fail(404);
    const asset=await env.ASSETS.fetch(req);return new Response(asset.body,{status:asset.status,headers:{...Object.fromEntries(asset.headers),...headers}});
  }catch(e){const code=[400,401,403,404,409,413,415,422,423,428,429].includes(e?.status)?e.status:503;
    const message={401:'Acesse novamente com seu CPF e código.',403:'Solicitação não autorizada.',409:'Os dados mudaram ou o limite foi atingido. Atualize a página.',413:'Arquivo ou conteúdo maior que o permitido.',415:'Use PDF, JPG ou PNG válido.',422:'Arquivo não aprovado pela verificação de segurança.',423:'Exclusão em andamento.',428:'Para continuar, saia e entre novamente.',429:'Muitas solicitações. Aguarde e tente novamente.'};
    return response(code,{error:message[code]||'Não foi possível concluir. Tente novamente.'});
  }},
  async scheduled(_event,env){if(ready(env))await cleanup(env);}
};
