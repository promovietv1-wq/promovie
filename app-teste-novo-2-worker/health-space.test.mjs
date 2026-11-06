import test from 'node:test';
import assert from 'node:assert/strict';
import {handleHealthSpace} from './src/health-space.mjs';
import worker from './src/index.mjs';

const origin='https://www.promovie.tv.br';
const key='fixture-only-'.repeat(4);
const sync='fixture-session-'.repeat(3);
const enc=new TextEncoder();

function cpf(base){
  let v=base;
  for(let n=9;n<=10;n++){
    let sum=0;
    for(let i=0;i<n;i++)sum+=Number(v[i])*(n+1-i);
    const digit=(sum*10)%11;
    v+=String(digit===10?0:digit);
  }
  return v;
}
const numberA=cpf('123456789'),numberB=cpf('987654321');
const codeA='A'.repeat(20),codeB='B'.repeat(20);
async function sign(secret,text){
  const digest=await crypto.subtle.digest('SHA-256',enc.encode(secret));
  const k=await crypto.subtle.importKey('raw',digest,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const sig=await crypto.subtle.sign('HMAC',k,enc.encode(text));
  return Array.from(new Uint8Array(sig),x=>x.toString(16).padStart(2,'0')).join('');
}
function memoryDb(){
  const people=new Map(),attempts=new Map(),sessions=new Map(),vaults=new Map(),docs=new Map(),consents=new Map();
  return {
    people,attempts,sessions,vaults,docs,consents,async exec(){},
    prepare(sql){
      let p=[];
      return {
        bind(...values){p=values;return this;},
        async first(){
          if(sql.includes("WHERE b.id=? AND b.situacao='ativo'")){
            const person=people.get(p[0]);
            return person&&person.situacao==='ativo'?{
              cpf_index:person.cpf_index,current_hash:person.code_hash,pending_hash:null
            }:null;
          }
          if(sql.includes('FROM pv_space_attempts'))return attempts.get(p[0])||null;
          if(sql.includes('FROM pv_beneficiarios b LEFT JOIN pv_access_codes')){
            const row=Array.from(people.values()).find(x=>x.cpf_index===p[0]&&x.situacao==='ativo');
            return row?{id:row.id,code_hash:row.code_hash,pending_hash:null}:null;
          }
          if(sql.includes('FROM pv_space_sessions s JOIN pv_beneficiarios')){
            const session=sessions.get(p[0]);
            const person=people.get(session?.beneficiario_id);
            return session&&session.expires_at>p[1]&&person?{
              beneficiario_id:person.id,code_hash:session.code_hash,situacao:person.situacao,
              current_hash:person.code_hash,pending_hash:null
            }:null;
          }
          if(sql.includes('FROM pv_space_vaults'))return vaults.get(p[0])||null;
          if(sql.includes('COUNT(*) AS total FROM pv_space_documents'))
            return {total:Array.from(docs.values()).filter(x=>x.owner===p[0]).length};
          if(sql.startsWith('SELECT ciphertext FROM pv_space_documents')){
            const row=docs.get(p[0]);
            return row?.owner===p[1]?{ciphertext:row.ciphertext}:null;
          }
          throw Error('Unexpected read query');
        },
        async run(){
          let changes=1;
          if(sql.startsWith('INSERT INTO pv_space_attempts'))attempts.set(p[0],{attempts:p[1],expires_at:p[2]});
          else if(sql.startsWith('DELETE FROM pv_space_attempts'))attempts.delete(p[0]);
          else if(sql.startsWith('INSERT INTO pv_space_sessions'))
            sessions.set(p[0],{beneficiario_id:p[1],code_hash:p[2],expires_at:p[3]});
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE token_hash='))sessions.delete(p[0]);
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE beneficiario_id=')){
            for(const [k,x] of sessions)if(x.beneficiario_id===p[0])sessions.delete(k);
          }
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_consents'))consents.set(p[0],p[1]);
          else if(sql.startsWith('DELETE FROM pv_space_consents'))consents.delete(p[0]);
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_vaults')){
            if(vaults.has(p[0]))changes=0;
            else vaults.set(p[0],{revision:1,salt:p[1],iv:p[2],ciphertext:p[3]});
          }
          else if(sql.startsWith('UPDATE pv_space_vaults SET')){
            const row=vaults.get(p[3]);
            if(!row||row.revision!==p[4]||row.salt!==p[5])changes=0;
            else vaults.set(p[3],{revision:row.revision+1,salt:row.salt,iv:p[0],ciphertext:p[1]});
          }
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_documents')){
            if(docs.has(p[0]))changes=0;
            else docs.set(p[0],{owner:p[1],ciphertext:p[2]});
          }
          else if(sql.startsWith('DELETE FROM pv_space_documents WHERE id=')){
            if(docs.get(p[0])?.owner===p[1])docs.delete(p[0]);
          }
          else if(sql.startsWith('DELETE FROM pv_space_documents WHERE beneficiario_id=')){
            for(const [k,x] of docs)if(x.owner===p[0])docs.delete(k);
          }
          else if(sql.startsWith('DELETE FROM pv_space_vaults'))vaults.delete(p[0]);
          else throw Error('Unexpected write query');
          return {meta:{changes}};
        }
      };
    }
  };
}
async function fixture(){
  const db=memoryDb();
  for(const [id,number,code] of [['person-a',numberA,codeA],['person-b',numberB,codeB]]){
    const idx=await sign('PromoVie|Indice|v1|'+key,number);
    const codeHash=await sign('PromoVie|CodigoAcesso|v1|'+key,idx+'|'+code);
    db.people.set(id,{id,cpf_index:idx,code_hash:codeHash,situacao:'ativo'});
  }
  return {db,env:{
    PROMOVIE_BENEFICIARIOS_DB:db,PROMOVIE_SPACE_ENABLED:'true',
    PROMOVIE_ADMIN_DATA_KEY:key,TELESAUDE_V3_SYNC_TOKEN:sync,ALLOWED_ORIGINS:origin
  }};
}
async function call(env,path,{method='GET',data,token,source=origin}={}){
  const headers={Origin:source};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==undefined)headers['Content-Type']='application/json';
  const req=new Request('https://backend.promovie.tv.br/api/promovie/space/v1'+path,{
    method,headers,...(data!==undefined?{body:JSON.stringify(data)}:{})
  });
  return handleHealthSpace(req,env);
}
async function login(env,number=numberA,code=codeA){
  const result=await call(env,'/session',{method:'POST',data:{cpf:number,codigo:code}});
  const body=await result.json();
  assert.equal(result.status,200,JSON.stringify(body));
  return body.token;
}
const vault={
  revision:0,salt:'a'.repeat(22),iv:'b'.repeat(16),ciphertext:'c'.repeat(120),consent:true
};
test('recurso permanece desativado por padrão e exige origem permitida',async()=>{
  const {env}=await fixture();
  assert.equal((await call({...env,PROMOVIE_SPACE_ENABLED:'false'},'/vault')).status,503);
  assert.equal((await call(env,'/health',{source:'https://external.example'})).status,403);
  assert.equal((await call(env,'/health')).status,200);
});
test('autenticação individual limita tentativas e revoga sessões antigas',async()=>{
  const {env,db}=await fixture();
  for(let i=0;i<6;i++){
    assert.equal((await call(env,'/session',{
      method:'POST',data:{cpf:numberA,codigo:codeB}
    })).status,401);
  }
  assert.equal((await call(env,'/session',{
    method:'POST',data:{cpf:numberA,codigo:codeA}
  })).status,429);
  const token=await login(env,numberB,codeB);
  assert.equal((await call(env,'/vault',{token})).status,200);
  db.people.get('person-b').code_hash='f'.repeat(64);
  assert.equal((await call(env,'/vault',{token})).status,401);
});
test('consentimento, separação de dados e revisão concorrente',async()=>{
  const {env,db}=await fixture();
  const tokenA=await login(env),tokenB=await login(env,numberB,codeB);
  assert.equal((await call(env,'/vault',{method:'PUT',token:tokenA,data:{...vault,consent:false}})).status,403);
  assert.equal((await call(env,'/vault',{method:'PUT',token:tokenA,data:vault})).status,200);
  assert.equal(db.consents.has('person-a'),true);
  assert.equal((await call(env,'/vault',{method:'PUT',token:tokenA,data:vault})).status,409);
  const readA=await (await call(env,'/vault',{token:tokenA})).json();
  const readB=await (await call(env,'/vault',{token:tokenB})).json();
  assert.equal(readA.record.ciphertext,vault.ciphertext);
  assert.equal(readB.record,null);
  assert.equal((await call(env,'/vault',{
    method:'PUT',token:tokenA,data:{...vault,revision:1,ciphertext:'d'.repeat(140)}
  })).status,200);
});
test('documentos só podem ser vistos e excluídos pelo proprietário',async()=>{
  const {env,db}=await fixture();
  const tokenA=await login(env),tokenB=await login(env,numberB,codeB);
  const id='86547a85-11f1-40e0-88ae-40db80b2493b';
  const ciphertext='b'.repeat(320);
  assert.equal((await call(env,'/documents',{
    method:'POST',token:tokenA,data:{id,ciphertext}
  })).status,201);
  assert.equal((await call(env,'/documents/'+id,{token:tokenA})).status,200);
  assert.equal((await call(env,'/documents/'+id,{token:tokenB})).status,404);
  await call(env,'/documents/'+id,{method:'DELETE',token:tokenB});
  assert.equal(db.docs.has(id),true);
  await call(env,'/documents/'+id,{method:'DELETE',token:tokenA});
  assert.equal(db.docs.has(id),false);
});
test('limite de dez documentos impede armazenamento excessivo por beneficiário',async()=>{
  const {env}=await fixture();
  const token=await login(env);
  for(let i=0;i<10;i++){
    const id=crypto.randomUUID();
    const result=await call(env,'/documents',{method:'POST',token,data:{
      id,ciphertext:'c'.repeat(128)
    }});
    assert.equal(result.status,201,'Documento '+(i+1));
  }
  assert.equal((await call(env,'/documents',{method:'POST',token,data:{
    id:crypto.randomUUID(),ciphertext:'d'.repeat(128)
  }})).status,413);
});
test('exclusão do cofre remove o consentimento e invalida a sessão',async()=>{
  const {env,db}=await fixture(),token=await login(env);
  assert.equal((await call(env,'/vault',{method:'PUT',token,data:vault})).status,200);
  assert.equal((await call(env,'/vault',{method:'DELETE',token,data:{codigo:codeB}})).status,403);
  assert.equal(db.vaults.has('person-a'),true,'Código de outro titular não pode excluir dados');
  assert.equal((await call(env,'/vault',{method:'DELETE',token,data:{codigo:codeA}})).status,200);
  assert.equal(db.consents.has('person-a'),false);
  assert.equal(db.vaults.has('person-a'),false);
  assert.equal((await call(env,'/vault',{token})).status,401);
});
test('preflight habilita PUT apenas para a origem institucional',async()=>{
  const {env}=await fixture();
  const req=new Request('https://backend.promovie.tv.br/api/promovie/space/v1/vault',{
    method:'OPTIONS',headers:{Origin:origin}
  });
  const response=await worker.fetch(req,env);
  assert.equal(response.status,204);
  assert.match(response.headers.get('Access-Control-Allow-Methods'),/PUT/);
});
