import test from 'node:test';
import assert from 'node:assert/strict';
import {handleHealthSpace} from './src/health-space.mjs';
import worker from './src/index.mjs';
const origin='https://www.promovie.tv.br', cpf='52998224725',cpfOther='16899535009';
const code='ABCDEFGHJKLMNPQRSTUV',otherCode='ABCDEFGHJKLMNPQRSTUW';
const key='chave-para-cifrar-dados-de-teste-super-secreta', sync='sincronizacao-ficticia-suficientemente-forte';
const enc=new TextEncoder();
async function hmac(secret,message){
  const raw=await crypto.subtle.digest('SHA-256',enc.encode(secret));
  const k=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(message))),b=>b.toString(16).padStart(2,'0')).join('');
}
function database(){
  const people=new Map(),attempts=new Map(),sessions=new Map(),vaults=new Map(),docs=new Map();
  return {people,attempts,sessions,vaults,docs,
    async exec(){return {success:true};},
    prepare(sql){let a=[];
      return {bind(...values){a=values;return this;},
        async first(){
          if(sql.includes('FROM pv_space_attempts'))return attempts.get(a[0])||null;
          if(sql.includes('FROM pv_beneficiarios b LEFT JOIN pv_access_codes')){
            const p=[...people.values()].find(p=>p.cpf_index===a[0]&&p.situacao==='ativo');
            return p?{id:p.id,code_hash:p.code_hash,pending_hash:null}:null;
          }
          if(sql.includes('FROM pv_space_sessions s JOIN pv_beneficiarios b')){
            const s=sessions.get(a[0]),p=people.get(s?.beneficiario_id);
            return s&&s.expires_at>a[1]&&p?{beneficiario_id:p.id,code_hash:s.code_hash,
              situacao:p.situacao,current_hash:p.code_hash,pending_hash:null}:null;
          }
          if(sql.includes('FROM pv_space_vaults'))return vaults.get(a[0])||null;
          if(sql.includes('COUNT(*) AS total FROM pv_space_documents'))
            return {total:[...docs.values()].filter(x=>x.beneficiario_id===a[0]).length};
          if(sql.startsWith('SELECT ciphertext FROM pv_space_documents')){
            const r=docs.get(a[0]);return r?.beneficiario_id===a[1]?r:null;
          }
          throw Error('unexpected first '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO pv_space_attempts'))attempts.set(a[0],{attempts:a[1],expires_at:a[2]});
          else if(sql.startsWith('DELETE FROM pv_space_attempts'))attempts.delete(a[0]);
          else if(sql.startsWith('INSERT INTO pv_space_sessions'))sessions.set(a[0],{beneficiario_id:a[1],code_hash:a[2],expires_at:a[3]});
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE token_hash='))sessions.delete(a[0]);
          else if(sql.startsWith('DELETE FROM pv_space_sessions WHERE beneficiario_id=')){
            for(const [k,x] of sessions)if(x.beneficiario_id===a[0])sessions.delete(k);
          }
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_vaults')){
            if(vaults.has(a[0]))return {meta:{changes:0}};
            vaults.set(a[0],{revision:1,salt:a[1],iv:a[2],ciphertext:a[3],updated_at:a[4]});
          }
          else if(sql.startsWith('UPDATE pv_space_vaults SET')){
            const r=vaults.get(a[3]);
            if(!r||r.revision!==a[4]||r.salt!==a[5])return {meta:{changes:0}};
            vaults.set(a[3],{revision:r.revision+1,iv:a[0],ciphertext:a[1],updated_at:a[2],salt:r.salt});
          }
          else if(sql.startsWith('INSERT OR IGNORE INTO pv_space_documents')){
            if(docs.has(a[0]))return {meta:{changes:0}};
            docs.set(a[0],{beneficiario_id:a[1],ciphertext:a[2],bytes:a[3]});
          }
          else if(sql.startsWith('DELETE FROM pv_space_documents WHERE id=')){
            if(docs.get(a[0])?.beneficiario_id===a[1])docs.delete(a[0]);
          }
          else if(sql.startsWith('DELETE FROM pv_space_documents WHERE beneficiario_id=')){
            for(const [k,x] of docs)if(x.beneficiario_id===a[0])docs.delete(k);
          }
          else if(sql.startsWith('DELETE FROM pv_space_vaults'))vaults.delete(a[0]);
          else throw Error('unexpected run '+sql);
          return {meta:{changes:1}};
        }
      };
    }
  };
}
async function seed(){
  const db=database();
  for(const [id,number,c] of [['p1',cpf,code],['p2',cpfOther,otherCode]]){
    const idx=await hmac('PromoVie|Indice|v1|'+key,number);
    const hashed=await hmac('PromoVie|CodigoAcesso|v1|'+key,idx+'|'+c);
    db.people.set(id,{id,cpf_index:idx,code_hash:hashed,situacao:'ativo'});
  }
  const env={PROMOVIE_SPACE_ENABLED:'true',PROMOVIE_BENEFICIARIOS_DB:db,PROMOVIE_ADMIN_DATA_KEY:key,
    TELESAUDE_V3_SYNC_TOKEN:sync,ALLOWED_ORIGINS:origin+',https://promovie.tv.br'};
  return {db,env};
}
function request(path,{method='GET',data,token,headerOrigin=origin}={}){
  const headers={Origin:headerOrigin};
  if(data!==undefined)headers['Content-Type']='application/json';
  if(token)headers.Authorization='Bearer '+token;
  return new Request('https://backend.promovie.tv.br/api/promovie/space/v1'+path,{method,headers,
    ...(data!==undefined?{body:JSON.stringify(data)}:{})});
}
async function hit(env,path,options){return handleHealthSpace(request(path,options),env,{'Access-Control-Allow-Origin':origin});}
async function login(env,number=cpf,c=code){
  const r=await hit(env,'/session',{method:'POST',data:{cpf:number,codigo:c}});
  const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result.token;
}
test('endpoint desativado por padrão; health verifica configuração e origem',async()=>{
  const {env}=await seed();
  assert.equal((await hit({...env,PROMOVIE_SPACE_ENABLED:'false'},'/health')).status,200);
  assert.equal((await hit({...env,PROMOVIE_SPACE_ENABLED:'false'},'/vault')).status,503);
  assert.equal((await hit(env,'/health',{headerOrigin:'https://site-malicioso.test'})).status,403);
  assert.equal((await hit(env,'/health')).status,200);
});
test('CPF e código pessoal, limite de erros e sessão individual',async()=>{
  const {env,db}=await seed();
  for(let i=0;i<6;i++)assert.equal((await hit(env,'/session',{method:'POST',data:{cpf,codigo:'ABCDEFGHIJKLMNOPQRST'}})).status,401);
  assert.equal((await hit(env,'/session',{method:'POST',data:{cpf,codigo:code}})).status,429);
  assert.equal((await hit(env,'/session',{method:'POST',data:{cpf:cpfOther,codigo:otherCode}})).status,200);
  assert.equal(db.sessions.size,1);
});
test('vault criptografado só do titular, revisão CAS, revogação e logout',async()=>{
  const {env,db}=await seed();const token=await login(env),token2=await login(env,cpfOther,otherCode);
  assert.deepEqual(await (await hit(env,'/vault',{token})).json(),{revision:0,record:null});
  const salt='AAAAAAAAAAAAAAAAAAAAAA',iv='BBBBBBBBBBBBBBBB',ciphertext='a'.repeat(100);
  assert.equal((await hit(env,'/vault',{method:'PUT',token,data:{revision:0,salt,iv,ciphertext}})).status,200);
  assert.equal((await hit(env,'/vault',{method:'PUT',token,data:{revision:0,salt,iv,ciphertext}})).status,409);
  assert.equal((await (await hit(env,'/vault',{token})).json()).record.ciphertext,ciphertext);
  assert.equal((await (await hit(env,'/vault',{token:token2})).json()).record,null);
  assert.equal((await hit(env,'/vault',{method:'PUT',token,data:{revision:1,salt,iv,ciphertext:'b'.repeat(150)}})).status,200);
  assert.equal((await (await hit(env,'/vault',{token})).json()).revision,2);
  db.people.get('p1').code_hash='f'.repeat(64);
  assert.equal((await hit(env,'/vault',{token})).status,401,'Código revogado invalida sessão');
  const fresh=await login(env,cpfOther,otherCode);
  assert.equal((await hit(env,'/logout',{method:'POST',token:fresh})).status,200);
  assert.equal((await hit(env,'/vault',{token:fresh})).status,401);
});
test('documentos criptografados respeitam owner, limite, exclusão e método',async()=>{
  const {env}=await seed(),t1=await login(env),t2=await login(env,cpfOther,otherCode);
  const id='70e4eed9-b268-4c03-9880-f39f386342cd',content='Abcd'.repeat(100);
  assert.equal((await hit(env,'/documents',{method:'POST',token:t1,data:{id,ciphertext:content}})).status,201);
  assert.equal((await hit(env,'/documents',{method:'POST',token:t1,data:{id,ciphertext:content}})).status,409);
  assert.equal((await hit(env,'/documents/'+id,{token:t2})).status,404);
  assert.equal((await hit(env,'/documents/'+id,{token:t1})).status,200);
  assert.equal((await hit(env,'/documents/'+id,{method:'DELETE',token:t2})).status,200);
  assert.equal((await hit(env,'/documents/'+id,{token:t1})).status,200);
  assert.equal((await hit(env,'/documents',{method:'POST',token:t1,data:{id:'x',ciphertext:content}})).status,400);
  assert.equal((await hit(env,'/vault',{method:'DELETE',token:t1})).status,200);
  assert.equal((await hit(env,'/vault',{token:t1})).status,401);
  assert.equal((await hit(env,'/documents/'+id,{token:t2})).status,404);
});
test('roteamento do Worker suporta preflight específico sem alterar Médicos',async()=>{
  const {env}=await seed();
  const req=new Request('https://backend.promovie.tv.br/api/promovie/space/v1/vault',{
    method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'PUT'}});
  const r=await worker.fetch(req,env);
  assert.equal(r.status,204);
  assert.match(r.headers.get('Access-Control-Allow-Methods'),/PUT/);
  assert.equal((await worker.fetch(new Request('https://backend.promovie.tv.br/api/promovie/space/v1/health',
    {headers:{Origin:'https://site-malicioso.test'}}),env)).status,403);
});
