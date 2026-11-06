import test from 'node:test';
import assert from 'node:assert/strict';
import {handleHealthSpace} from './src/health-space.mjs';
import worker from './src/index.mjs';

const origin='https://www.promovie.tv.br',alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const secret='test-data-key-'.repeat(4),sync='test-session-key-'.repeat(3);
const encoder=new TextEncoder();
const idA='person-a',idB='person-b';
function makeCPF(seed){
  let cpf=seed;
  for(let n=9;n<=10;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(cpf[i])*(n+1-i);let d=(sum*10)%11;cpf+=d===10?'0':String(d);}
  return cpf;
}
const cpfA=makeCPF('123456789'),cpfB=makeCPF('987654321'),codeA='A'.repeat(20),codeB='B'.repeat(20);
async function sign(key,message){
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(key));
  const cryptoKey=await crypto.subtle.importKey('raw',digest,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(message));
  return Array.from(new Uint8Array(signed),b=>b.toString(16).padStart(2,'0')).join('');
}
function dbMock(){
  const people=new Map(),attempts=new Map(),sessions=new Map(),vaults=new Map(),documents=new Map(),consents=new Map();
  return {people,attempts,sessions,vaults,documents,consents,async exec(){},
    prepare(sql){let p=[];
      return {bind(...args){p=args;return this;},
        async first(){
          if(sql.includes('FROM pv_space_attempts'))return attempts.get(p[0])||null;
          if(sql.includes('FROM pv_beneficiarios b LEFT JOIN pv_access_codes')){
            const person=[...people.values()].find(x=>x.cpf_index===p[0]&&x.situacao==='ativo');
            return person?{id:person.id,code_hash:person.code_hash,pending_hash:null}:null;
          }
          if(sql.includes('FROM pv_space_sessions s')){
            const session=sessions.get(p[0]),person=people.get(session?.beneficiario_id);
            return session&&session.expires_at>p[1]&&person?{
              beneficiario_id:person.id,code_hash:session.code_hash,situacao:person.situacao,
              current_hash:person.code_hash,pending_hash:null
            }:null;
          }
          if(sql.includes('FROM pv_space_vaults'))return vaults.get(p[0])||null;
          if(sql.includes('COUNT(*) AS total FROM pv_space_documents'))
            return {total:[...documents.values()].filter(x=>x.beneficiario_id===p[0]).length};
          if(sql.startsWith('SELECT ciphertext FROM pv_space_documents')){
            const doc=documents.get(p[0]);
            return doc?.beneficiario_id===p[1]?doc:null;
          }
          throw Error('Unknown first query');
        },
        async run(){
          let changes=1;
          if(sql.startsWith('INSERT INTO pv_space_attempts'))attempts.set(p[0],{attempts:p[1],expires_at:p[2]});
          else if(sql.startsWith('DELETE FROM pv_space_attempts'))attempts.delete(p[0]);
          else if(sql.startsWith('INSERT INTO pv_space_sessions'))sessions.set(p[0],{beneficiario_id:p[1],code_hash:p[2],expires_at:p[3]});
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE token_hash='))sessions.delete(p[0]);
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE beneficiario_id=')){
            for(const [k,s] of sessions)if(s.beneficiario_id===p[0])sessions.delete(k);
          }else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_consents'))consents.set(p[0],p[1]);
          else if(sql.startsWith('DELETE FROM pv_space_consents'))consents.delete(p[0]);
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_vaults')){
            if(vaults.has(p[0]))changes=0;
            else vaults.set(p[0],{revision:1,salt:p[1],iv:p[2],ciphertext:p[3],updated_at:p[4]});
          }else if(sql.startsWith('UPDATE pv_space_vaults SET')){
            const row=vaults.get(p[3]);
            if(!row||row.revision!==p[4]||row.salt!==p[5])changes=0;
            else vaults.set(p[3],{revision:row.revision+1,salt:row.salt,iv:p[0],ciphertext:p[1],updated_at:p[2]});
          }else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_documents')){
            if(documents.has(p[0]))changes=0;
            else documents.set(p[0],{beneficiario_id:p[1],ciphertext:p[2]});
          }else if(sql.startsWith('DELETE FROM pv_space_documents WHERE id=')){
            if(documents.get(p[0])?.beneficiario_id===p[1])documents.delete(p[0]);
          }else if(sql.startsWith('DELETE FROM pv_space_documents WHERE beneficiario_id=')){
            for(const [k,x] of documents)if(x.beneficiario_id===p[0])documents.delete(k);
          }else if(sql.startsWith('DELETE FROM pv_space_vaults'))vaults.delete(p[0]);
          else throw Error('Unknown write query');
          return {meta:{changes}};
        }
      };
    }
  };
}
async function fixture(){
  const db=dbMock();
  for(const [id,cpf,code] of [[idA,cpfA,codeA],[idB,cpfB,codeB]]){
    const index=await sign('PromoVie|Indice|v1|'+secret,cpf);
    const code_hash=await sign('PromoVie|CodigoAcesso|v1|'+secret,index+'|'+code);
    db.people.set(id,{id,cpf_index:index,code_hash,situacao:'ativo'});
  }
  return {db,env:{
    PROMOVIE_BENEFICIARIOS_DB:db,PROMOVIE_SPACE_ENABLED:'true',PROMOVIE_ADMIN_DATA_KEY:secret,
    TELESAUDE_V3_SYNC_TOKEN:sync,ALLOWED_ORIGINS:origin
  }};
}
async function call(env,path,{method='GET',data,token,source=origin}={}){
  const headers={Origin:source};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==undefined)headers['Content-Type']='application/json';
  const req=new Request('https://backend.promovie.tv.br/api/promovie/space/v1'+path,
    {method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})});
  return handleHealthSpace(req,env);
}
async function login(env,cpf=cpfA,codigo=codeA){
  const r=await call(env,'/session',{method:'POST',data:{cpf,codigo}});
  const body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body.token;
}
const vault={revision:0,salt:'a'.repeat(22),iv:'b'.repeat(16),ciphertext:'c'.repeat(120),consent:true};
test('feature flag e origem controlam acesso ao espaço privado',async()=>{
  const {env}=await fixture();
  assert.equal((await call({...env,PROMOVIE_SPACE_ENABLED:'false'},'/vault')).status,503);
  assert.equal((await call(env,'/health',{source:'https://externo.test'})).status,403);
  assert.equal((await call(env,'/health')).status,200);
});
test('login usa código individual, bloqueia tentativas e revogação invalida sessão',async()=>{
  const {env,db}=await fixture();
  for(let i=0;i<6;i++)assert.equal((await call(env,'/session',{method:'POST',data:{cpf:cpfA,codigo:codeB}})).status,401);
  assert.equal((await call(env,'/session',{method:'POST',data:{cpf:cpfA,codigo:codeA}})).status,429);
  const token=await login(env,cpfB,codeB);
  assert.equal((await call(env,'/vault',{token})).status,200);
  db.people.get(idB).code_hash='f'.repeat(64);
  assert.equal((await call(env,'/vault',{token})).status,401);
});
test('dados cifrados não vazam entre beneficiários e revisão impede sobrescrita',async()=>{
  const {env,db}=await fixture(),a=await login(env),b=await login(env,cpfB,codeB);
  assert.equal((await call(env,'/vault',{token:a})).status,200);
  assert.equal((await call(env,'/vault',{method:'PUT',token:a,data:{...vault,consent:false}})).status,403);
  assert.equal((await call(env,'/vault',{method:'PUT',token:a,data:vault})).status,200);
  assert.equal(db.consents.has(idA),true);
  assert.equal((await call(env,'/vault',{method:'PUT',token:a,data:vault})).status,409);
  const onlyA=await (await call(env,'/vault',{token:a})).json();
  assert.equal(onlyA.record.ciphertext,vault.ciphertext);
  assert.equal((await (await call(env,'/vault',{token:b})).json()).record,null);
  const next=await call(env,'/vault',{method:'PUT',token:a,data:{...vault,revision:1,ciphertext:'d'.repeat(140)}});
  assert.equal(next.status,200);
});
test('arquivos são apenas texto cifrado e separados por proprietário',async()=>{
  const {env,db}=await fixture(),a=await login(env),b=await login(env,cpfB,codeB);
  const id='86547a85-11f1-40e0-88ae-40db80b2493b',ciphertext:'b'.repeat(320);
  assert.equal((await call(env,'/documents',{method:'POST',token:a,data:{id,ciphertext}})).status,201);
  assert.equal((await call(env,'/documents/'+id,{token:a})).status,200);
  assert.equal((await call(env,'/documents/'+id,{token:b})).status,404);
  await call(env,'/documents/'+id,{method:'DELETE',token:b});
  assert.equal(db.documents.has(id),true);
  await call(env,'/documents/'+id,{method:'DELETE',token:a});
  assert.equal(db.documents.has(id),false);
});
test('excluir o cofre remove dados, consentimento e sessões',async()=>{
  const {env,db}=await fixture(),a=await login(env);
  assert.equal((await call(env,'/vault',{method:'PUT',token:a,data:vault})).status,200);
  assert.equal((await call(env,'/vault',{method:'DELETE',token:a})).status,200);
  assert.equal(db.consents.has(idA),false);
  assert.equal(db.vaults.has(idA),false);
  assert.equal((await call(env,'/vault',{token:a})).status,401);
});
test('preflight CORS para PUT sem modificar outras integrações',async()=>{
  const {env}=await fixture();
  const r=await worker.fetch(new Request('https://backend.promovie.tv.br/api/promovie/space/v1/vault',
    {method:'OPTIONS',headers:{Origin:origin}}),env);
  assert.equal(r.status,204);
  assert.match(r.headers.get('Access-Control-Allow-Methods'),/PUT/);
});
