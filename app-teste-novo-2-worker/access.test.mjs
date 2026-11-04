import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleAdmin,handleBeneficiaryAccess} from './src/admin.mjs';

const origin='https://www.promovie.tv.br';
const cpf='52998224725'; // CPF válido fictício usado somente nas simulações.
const base={
  ALLOWED_ORIGINS:'https://www.promovie.tv.br,https://promovie.tv.br',
  PROMOVIE_ADMIN_PASSWORD:'senha-administrativa-ficticia-2026',
  PROMOVIE_ADMIN_DATA_KEY:'chave-ficticia-suficientemente-longa-para-testes',
  TELESAUDE_V3_SYNC_TOKEN:'token-de-homologacao-ficticio-longo',
  TELESAUDE_V3_ENABLED:'false',
  TELESAUDE_V3_WRITE_ENABLED:'false',
  WIDGET_ENVIRONMENT:'production',
  MEDIQUO_V3_PLAN:'345',
  MEDIQUO_V3_BASE_URL:'https://sdk.mediquo.com/v1',
  MEDIQUO_V3_WIDGET_API_KEY:'widget-publica-ficticia',
  MEDIQUO_V3_SDK_SECRET_KEY:'segredo-apenas-ficticio'
};
function database(){
  const sessions=new Map(),attempts=new Map(),people=new Map(),history=[];
  const accessCodes=new Map(),accessAttempts=new Map(),schemas=[];
  return {
    sessions,attempts,people,history,accessCodes,accessAttempts,schemas,
    async exec(sql){schemas.push(sql);return {success:true};},
    prepare(sql){
      let a=[];
      return {
        bind(...values){a=values;return this;},
        async first(){
          if(sql==='SELECT 1 AS ok')return {ok:1};
          if(sql.includes('FROM pv_admin_login_attempts'))return attempts.get(a[0])||null;
          if(sql.includes('FROM pv_admin_sessions'))return sessions.get(a[0])?.expires_at>a[1]?sessions.get(a[0]):null;
          if(sql.includes('FROM pv_beneficiarios WHERE cpf_index=?'))
            return [...people.values()].find(x=>x.cpf_index===a[0])||null;
          if(sql.includes('FROM pv_beneficiarios WHERE id=?'))return people.get(a[0])||null;
          if(sql.includes('FROM pv_access_attempts'))return accessAttempts.get(a[0])||null;
          if(sql.includes('JOIN pv_access_codes')){
            const p=[...people.values()].find(x=>x.cpf_index===a[0]&&x.situacao==='ativo');
            if(!p||!accessCodes.has(p.id))return null;
            return {id:p.id,code_hash:accessCodes.get(p.id).code_hash};
          }
          throw Error('SQL first inesperada: '+sql);
        },
        async all(){
          if(sql.includes('FROM pv_historico'))return {results:history.filter(x=>x.beneficiario_id===a[0])};
          if(sql.includes('FROM pv_beneficiarios ORDER BY'))return {results:[...people.values()]};
          throw Error('SQL all inesperada: '+sql);
        },
        async run(){
          if(sql.startsWith('INSERT INTO pv_admin_login_attempts'))attempts.set(a[0],{attempts:a[1],expires_at:a[2]});
          else if(sql.startsWith('DELETE FROM pv_admin_login_attempts'))attempts.delete(a[0]);
          else if(sql.startsWith('INSERT INTO pv_admin_sessions'))sessions.set(a[0],{token_hash:a[0],expires_at:a[2]});
          else if(sql.startsWith('DELETE FROM pv_admin_sessions'))sessions.delete(a[0]);
          else if(sql.startsWith('INSERT INTO pv_beneficiarios'))people.set(a[0],{
            id:a[0],cpf_index:a[1],cpf_hint:a[2],dados_criptografados:a[3],situacao:a[4],
            plano:a[5],criado_em:a[6],atualizado_em:a[7],enviado_em:null,arquivado_em:null
          });
          else if(sql.startsWith('INSERT INTO pv_historico'))history.push({
            id:a[0],beneficiario_id:a[1],evento:a[2],registrado_em:a[3],detalhes:a[4]});
          else if(sql.startsWith('INSERT INTO pv_access_codes'))accessCodes.set(a[0],{code_hash:a[1],criado_em:a[2]});
          else if(sql.startsWith('DELETE FROM pv_access_codes'))accessCodes.delete(a[0]);
          else if(sql.startsWith('INSERT INTO pv_access_attempts'))accessAttempts.set(a[0],{attempts:a[1],expires_at:a[2]});
          else if(sql.startsWith('DELETE FROM pv_access_attempts'))accessAttempts.delete(a[0]);
          else throw Error('SQL run inesperada: '+sql);
          return {success:true};
        }
      };
    }
  };
}
function envFor(db,overrides={}){return {...base,PROMOVIE_BENEFICIARIOS_DB:db,...overrides};}
async function call(handler,db,path,{method='GET',body,cookie,originHeader=origin}={},overrides={}){
  const headers=new Headers();
  if(originHeader)headers.set('Origin',originHeader);
  if(cookie)headers.set('Cookie',cookie);
  if(body!==undefined)headers.set('Content-Type','application/json');
  headers.set('CF-Connecting-IP','192.0.2.55');
  const prefix=handler===handleAdmin?'/api/promovie/admin/v1':'/api/promovie/access/v1';
  return handler(new Request('https://backend.promovie.tv.br'+prefix+path,{
    method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})
  }),envFor(db,overrides),{'Access-Control-Allow-Origin':origin});
}
async function seed(){
  const db=database();
  const login=await call(handleAdmin,db,'/login',{method:'POST',body:{senha:base.PROMOVIE_ADMIN_PASSWORD}});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const created=await call(handleAdmin,db,'/records',{method:'POST',cookie,body:{nome:'Pessoa Fictícia',cpf}});
  assert.equal(created.status,201);
  const id=(await created.json()).id;
  db.people.get(id).situacao='ativo'; // Simula plano confirmado no SDK sem enviar paciente real.
  return {db,cookie,id};
}
function vendorMock({active=true}={}){
  const before=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,opts)=>{
    calls.push({url:String(url),verb:opts.method,headers:opts.headers});
    if(String(url)==='https://sdk.mediquo.com/v1/patients/'+cpf&&opts.method==='GET'){
      return new Response(JSON.stringify({patient:{code:cpf,plan:'345',active}}),{
        status:200,headers:{'Content-Type':'application/json'}});
    }
    if(String(url)==='https://sdk.mediquo.com/v1/patients/authenticate?code='+cpf&&opts.method==='POST'){
      return new Response(JSON.stringify({access_token:'token-ficticio-de-sessao'}),{
        status:200,headers:{'Content-Type':'application/json'}});
    }
    throw Error('Acesso externo inesperado: '+url);
  };
  return {calls,restore(){globalThis.fetch=before;}};
}
test('gestor gera código aleatório de 20 caracteres, guardado somente como HMAC, e revoga',async()=>{
  const {db,cookie,id}=await seed();
  const r=await call(handleAdmin,db,'/records/'+id+'/access-code',{method:'POST',cookie,body:{}});
  assert.equal(r.status,200);
  const code=(await r.json()).codigo;
  assert.match(code,/^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){3}$/);
  assert.ok(!db.accessCodes.get(id).code_hash.includes(code.replace(/-/g,'')));
  assert.ok(!db.history.some(x=>x.detalhes?.includes(code)));
  assert.ok(db.schemas.some(sql=>sql.includes('pv_access_codes')));
  const renew=await call(handleAdmin,db,'/records/'+id+'/access-code',{method:'POST',cookie,body:{}});
  assert.notEqual((await renew.json()).codigo,code);
  const revoke=await call(handleAdmin,db,'/records/'+id+'/revoke-access',{method:'POST',cookie,body:{}});
  assert.equal(revoke.status,200);
  assert.equal(db.accessCodes.size,0);
});
test('somente gestor autenticado pode gerar códigos e não há cadastramento automático',async()=>{
  const {db,id}=await seed();
  assert.equal((await call(handleAdmin,db,'/records/'+id+'/access-code',{method:'POST',body:{}})).status,401);
  assert.equal((await call(handleAdmin,db,'/records/'+id+'/access-code',{
    method:'POST',body:{},originHeader:'https://site-malicioso.example'})).status,403);
  const a=await call(handleBeneficiaryAccess,db,'/session',{method:'POST',body:{cpf,codigo:'AAAAAAAAAAAAAAAAAAAA'}});
  assert.equal(a.status,503);
});
test('beneficiário autenticado gera token SDK somente com CPF, código e plano ativos',async()=>{
  const {db,cookie,id}=await seed();
  const r=await call(handleAdmin,db,'/records/'+id+'/access-code',{method:'POST',cookie,body:{}});
  const code=(await r.json()).codigo;
  const mock=vendorMock();
  try{
    assert.equal((await call(handleBeneficiaryAccess,db,'/health',{}, {TELESAUDE_V3_ENABLED:'true'})).status,200);
    const wrong=await call(handleBeneficiaryAccess,db,'/session',{
      method:'POST',body:{cpf,codigo:'AAAAAAAAAAAAAAAAAAAA'}},{TELESAUDE_V3_ENABLED:'true'});
    assert.equal(wrong.status,401);
    assert.equal(mock.calls.length,0);
    const ok=await call(handleBeneficiaryAccess,db,'/session',{
      method:'POST',body:{cpf,codigo:code.toLowerCase()}},{TELESAUDE_V3_ENABLED:'true'});
    assert.equal(ok.status,200);
    const out=await ok.json();
    assert.equal(out.access_token,'token-ficticio-de-sessao');
    assert.equal(out.environment,'production');
    assert.equal(out.apiKey,base.MEDIQUO_V3_WIDGET_API_KEY);
    assert.equal(mock.calls.length,2);
    assert.deepEqual(mock.calls.map(x=>x.verb),['GET','POST']);
    assert.equal(mock.calls[1].headers['X-Secret-Key'],base.MEDIQUO_V3_SDK_SECRET_KEY);
  }finally{mock.restore();}
});
test('licença inativa não recebe token e revogação impede novas sessões',async()=>{
  const {db,cookie,id}=await seed();
  const code=(await (await call(handleAdmin,db,'/records/'+id+'/access-code',{
    method:'POST',cookie,body:{}})).json()).codigo;
  const mock=vendorMock({active:false});
  try{
    const r=await call(handleBeneficiaryAccess,db,'/session',{
      method:'POST',body:{cpf,codigo:code}},{TELESAUDE_V3_ENABLED:'true'});
    assert.equal(r.status,403);
    assert.deepEqual(mock.calls.map(x=>x.verb),['GET']);
  }finally{mock.restore();}
  await call(handleAdmin,db,'/records/'+id+'/revoke-access',{method:'POST',cookie,body:{}});
  const after=await call(handleBeneficiaryAccess,db,'/session',{
    method:'POST',body:{cpf,codigo:code}},{TELESAUDE_V3_ENABLED:'true'});
  assert.equal(after.status,401);
});
test('bloqueio distribuído no D1 após seis códigos inválidos do mesmo CPF',async()=>{
  const {db,cookie,id}=await seed();
  await call(handleAdmin,db,'/records/'+id+'/access-code',{method:'POST',cookie,body:{}});
  for(let i=0;i<6;i++){
    const r=await call(handleBeneficiaryAccess,db,'/session',{
      method:'POST',body:{cpf,codigo:'AAAAAAAAAAAAAAAAAAAA'}},{TELESAUDE_V3_ENABLED:'true'});
    assert.equal(r.status,401);
  }
  const blocked=await call(handleBeneficiaryAccess,db,'/session',{
    method:'POST',body:{cpf,codigo:'AAAAAAAAAAAAAAAAAAAA'}},{TELESAUDE_V3_ENABLED:'true'});
  assert.equal(blocked.status,429);
});
test('interface pública não contém autenticação fictícia nem chaves privadas',async()=>{
  const html=await readFile(new URL('../telesaude/index.html',import.meta.url),'utf8');
  const panel=await readFile(new URL('../telesaude/gestao/index.html',import.meta.url),'utf8');
  assert.match(html,/id="access-cpf"/);
  assert.match(html,/id="access-code"/);
  assert.match(html,/\/api\/promovie\/access\/v1/);
  assert.doesNotMatch(html,/CPF do paciente fictício|Senha da conta de teste|Homologação<\/small>/);
  assert.doesNotMatch(html,/MEDIQUO_V3_SDK_SECRET_KEY\s*=/);
  assert.match(panel,/id="generate-access-button"/);
  assert.match(panel,/id="revoke-access-button"/);
  assert.match(panel,/id="access-code-dialog"/);
});
