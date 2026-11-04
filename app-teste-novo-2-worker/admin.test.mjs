import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleAdmin} from './src/admin.mjs';

const origin='https://www.promovie.tv.br';
const cpf='52998224725'; // CPF válido fictício, somente simulação local.
const envConfig={
  ALLOWED_ORIGINS:'https://www.promovie.tv.br,https://promovie.tv.br',
  PROMOVIE_ADMIN_PASSWORD:'senha-teste-ficticia-forte-2026',
  PROMOVIE_ADMIN_DATA_KEY:'chave-de-criptografia-ficticia-128-caracteres',
  TELESAUDE_V3_SYNC_TOKEN:'token-de-sessao-e-indice-ficticio-123456',
  TELESAUDE_V3_WRITE_ENABLED:'false',
  TELESAUDE_V3_TEST_CPF:cpf,
  MEDIQUO_V3_BASE_URL:'https://sdk.mediquo.com/v1',
  MEDIQUO_V3_WIDGET_API_KEY:'chave-publica-ficticia',
  MEDIQUO_V3_SDK_SECRET_KEY:'chave-secreta-ficticia'
};
function database(){
 const sessions=new Map(),attempts=new Map(),people=new Map(),history=[];
 const d={
  sessions,attempts,people,history,
  prepare(sql){
    let a=[];
    return {
      bind(...values){a=values;return this;},
      async first(){
        if(sql.includes('FROM pv_admin_login_attempts'))return attempts.get(a[0])||null;
        if(sql.includes('FROM pv_admin_sessions'))return sessions.get(a[0])?.expires_at>a[1]?sessions.get(a[0]):null;
        if(sql.includes('FROM pv_beneficiarios WHERE cpf_index=?'))return [...people.values()].find(p=>p.cpf_index===a[0])||null;
        if(sql.includes('FROM pv_beneficiarios WHERE id=?'))return people.get(a[0])||null;
        throw Error('SQL first inesperada: '+sql);
      },
      async all(){
        if(sql.includes('FROM pv_beneficiarios ORDER BY')){
          const items=[...people.values()].sort((x,y)=>y.criado_em.localeCompare(x.criado_em));
          return {results:items.slice(a[1],a[1]+a[0])};
        }
        if(sql.includes('FROM pv_historico WHERE'))return {results:history
          .filter(x=>x.beneficiario_id===a[0])
          .sort((x,y)=>y.registrado_em.localeCompare(x.registrado_em))};
        throw Error('SQL all inesperada: '+sql);
      },
      async run(){
        if(sql.startsWith('INSERT INTO pv_admin_login_attempts')){
          attempts.set(a[0],{actor_hash:a[0],attempts:a[1],expires_at:a[2]});
        }else if(sql.startsWith('DELETE FROM pv_admin_login_attempts'))attempts.delete(a[0]);
        else if(sql.startsWith('INSERT INTO pv_admin_sessions')){
          sessions.set(a[0],{token_hash:a[0],created_at:a[1],expires_at:a[2]});
        }else if(sql.startsWith('DELETE FROM pv_admin_sessions'))sessions.delete(a[0]);
        else if(sql.startsWith('INSERT INTO pv_beneficiarios')){
          people.set(a[0],{id:a[0],cpf_index:a[1],cpf_hint:a[2],dados_criptografados:a[3],
            situacao:a[4],situacao_anterior:null,plano:a[5],criado_em:a[6],atualizado_em:a[7],
            enviado_em:null,arquivado_em:null});
        }else if(sql.startsWith('INSERT INTO pv_historico')){
          history.push({id:a[0],beneficiario_id:a[1],evento:a[2],registrado_em:a[3],detalhes:a[4]});
        }else if(sql.includes("SET situacao_anterior=?,situacao=?,arquivado_em=?")){
          const x=people.get(a[4]);Object.assign(x,{situacao_anterior:a[0],situacao:a[1],arquivado_em:a[2],atualizado_em:a[3]});
        }else if(sql.includes("SET situacao=?,situacao_anterior=NULL")){
          const x=people.get(a[2]);Object.assign(x,{situacao:a[0],situacao_anterior:null,arquivado_em:null,atualizado_em:a[1]});
        }else if(sql.includes("SET situacao=?,enviado_em=?")){
          const x=people.get(a[3]);Object.assign(x,{situacao:a[0],enviado_em:a[1],atualizado_em:a[2]});
        }else if(sql.includes("SET situacao=?,atualizado_em=?")){
          const x=people.get(a[2]);Object.assign(x,{situacao:a[0],atualizado_em:a[1]});
        }else throw Error('SQL run inesperada: '+sql);
        return {success:true};
      }
    };
  }
 };
 return d;
}
const config=(db,extra={})=>({...envConfig,PROMOVIE_BENEFICIARIOS_DB:db,...extra});
async function call(db,path,{method='GET',body,cookie,passOrigin=true}={},extra={}){
 const headers=new Headers();
 if(passOrigin)headers.set('Origin',origin);
 if(cookie)headers.set('Cookie',cookie);
 if(body)headers.set('Content-Type','application/json');
 headers.set('CF-Connecting-IP','192.0.2.55');
 const request=new Request('https://backend.promovie.tv.br/api/promovie/admin/v1'+path,{
    method,headers,...(body?{body:JSON.stringify(body)}:{})
 });
 return handleAdmin(request,config(db,extra),{'Access-Control-Allow-Origin':origin});
}
async function login(db,password=envConfig.PROMOVIE_ADMIN_PASSWORD){
 const resp=await call(db,'/login',{method:'POST',body:{senha:password}});
 const cookie=resp.headers.get('set-cookie')?.split(';')[0];
 return {resp,cookie};
}
test('painel fica bloqueado até existir banco e segredos independentes',async()=>{
 const r=await handleAdmin(new Request('https://backend.promovie.tv.br/api/promovie/admin/v1/me'),{}, {});
 assert.equal(r.status,503);
 const db=database();
 assert.equal((await call(db,'/me')).status,401);
 assert.equal((await call(db,'/login',{method:'POST',body:{senha:'errada'},passOrigin:false})).status,403);
});
test('senha administrativa cria cookie HttpOnly, protege a sessão e permite encerramento',async()=>{
 const db=database();
 const bad=await login(db,'incorreta-12345678');assert.equal(bad.resp.status,401);
 const {resp,cookie}=await login(db);
 assert.equal(resp.status,200);assert.ok(cookie?.startsWith('__Host-pv_admin='));
 assert.match(resp.headers.get('set-cookie'),/HttpOnly/);
 assert.match(resp.headers.get('set-cookie'),/Secure/);
 assert.match(resp.headers.get('set-cookie'),/SameSite=Strict/);
 assert.equal((await call(db,'/me',{cookie})).status,200);
 assert.equal((await call(db,'/me')).status,401);
 assert.equal((await call(db,'/logout',{method:'POST',cookie,body:{}})).status,200);
 assert.equal((await call(db,'/me',{cookie})).status,401);
});
test('arquivo criptografa CPF e contatos, evita duplicação e lista apenas usuário logado',async()=>{
 const db=database(),{cookie}=await login(db);
 const form={nome:'Marco Polese',cpf,email:'contato@example.com',telefone:'27988888888'};
 const created=await call(db,'/records',{method:'POST',cookie,body:form});
 assert.equal(created.status,201);
 const id=(await created.json()).id;assert.ok(id);
 const row=db.people.get(id);
 assert.ok(row);assert.doesNotMatch(row.dados_criptografados,/52998224725|Marco Polese|contato@example/);
 assert.doesNotMatch(row.cpf_index,/52998224725/);
 const list=await call(db,'/records',{cookie});
 assert.equal(list.status,200);
 const data=await list.json();
 assert.equal(data.registros[0].nome,'Marco Polese');
 assert.notEqual(data.registros[0].cpf,cpf);
 assert.equal(data.registros[0].email,null);
 const detail=await call(db,'/records/'+id,{cookie});
 assert.equal((await detail.json()).registro.cpf,cpf);
 const dupe=await call(db,'/records',{method:'POST',cookie,body:form});
 assert.equal(dupe.status,409);
 assert.equal(db.people.size,1);
 assert.equal((await call(db,'/records')).status,401);
});
test('arquivo restaura e preserva histórico sem suspender serviço da Médiquo',async()=>{
 const db=database(),{cookie}=await login(db);
 const r=await call(db,'/records',{method:'POST',cookie,body:{nome:'Pessoa De Teste',cpf}});
 const id=(await r.json()).id;
 const a=await call(db,'/records/'+id+'/archive',{method:'POST',cookie,body:{}});
 assert.equal(a.status,200);
 assert.match((await a.json()).explicacao,/NÃO foi suspensa/);
 const restored=await call(db,'/records/'+id+'/restore',{method:'POST',cookie,body:{}});
 assert.equal(restored.status,200);assert.equal((await restored.json()).situacao,'rascunho');
 const hist=await call(db,'/records/'+id+'/history',{cookie});
 const events=(await hist.json()).historico.map(x=>x.evento);
 assert.ok(events.includes('cadastro_local'));
 assert.ok(events.includes('arquivado'));
 assert.ok(events.includes('restaurado'));
});
test('cadastro real na Médiquo está bloqueado sem autorização de escrita',async()=>{
 const db=database(),{cookie}=await login(db);
 const cr=await call(db,'/records',{method:'POST',cookie,body:{nome:'Pessoa Teste',cpf}});
 const id=(await cr.json()).id;
 const response=await call(db,'/records/'+id+'/send',{method:'POST',cookie,body:{}});
 assert.equal(response.status,503);
 const row=db.people.get(id);assert.equal(row.situacao,'rascunho');
});
test('HTML usa somente login por senha e não contém chaves ou token no navegador',async()=>{
 const html=await readFile(new URL('../telesaude/gestao/index.html',import.meta.url),'utf8');
 assert.match(html,/id="login-form"/);
 assert.match(html,/id="record-list"/);
 assert.match(html,/id="history"/);
 assert.match(html,/credentials:'include'/);
 assert.match(html,/noindex,nofollow/);
 assert.doesNotMatch(html,/id="token"|MEDIQUO_V3_SDK_SECRET_KEY\s*=/);
 const sql=await readFile(new URL('./schema-promovie.sql',import.meta.url),'utf8');
 assert.match(sql,/pv_beneficiarios/);
 assert.match(sql,/pv_admin_sessions/);
});
