import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {issueDirectoryGrant,handleDirectory} from "./src/directory.mjs";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin="https://www.promovie.tv.br";
const codeHash="b".repeat(64);
function makeEnvironment(){
  const sessions=new Map();
  const db={
    async exec(){return {success:true};},
    prepare(sql){
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async run(){
          if(sql.startsWith("INSERT INTO pv_directory_sessions"))
            sessions.set(args[0],{access_hash:args[2],expires_at:args[3]});
          return {success:true};
        },
        async first(){
          if(!sql.includes("FROM pv_directory_sessions"))throw Error("Unexpected SQL");
          const s=sessions.get(args[0]);
          return s&&s.expires_at>args[1]?{
            access_hash:s.access_hash,code_hash:codeHash,pending_hash:null
          }:null;
        }
      };
    }
  };
  const env={
    PROMOVIE_DIRECTORY_ENABLED:"true",
    PROMOVIE_BENEFICIARIOS_DB:db,
    ALLOWED_ORIGINS:origin,
    MEDIQUO_V3_PLAN:"345",
    MEDIQUO_V3_BASE_URL:"https://sdk.mediquo.com/v1",
    MEDIQUO_V3_WIDGET_API_KEY:"TEST-PUBLIC",
    MEDIQUO_V3_SDK_SECRET_KEY:"TEST-PRIVATE-DO-NOT-PUBLISH",
    TELESAUDE_V3_SYNC_TOKEN:"TEST-PRIVATE-LONG-LONG-SESSION-KEY"
  };
  return {env,sessions};
}
function request(token,originHeader=origin){
  const headers={Origin:originHeader};
  if(token)headers.Authorization="Bearer "+token;
  return new Request("https://backend.promovie.tv.br/api/promovie/directory/v1/catalog",{headers});
}
test("Sem autorização não publica o catálogo e não consulta o fornecedor",async()=>{
  const {env}=makeEnvironment();
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;throw Error("never call");};
  try{
    assert.equal((await handleDirectory(request(null),env)).status,401);
    assert.equal((await handleDirectory(request("A".repeat(43),"https://wrong.example"),env)).status,403);
    assert.equal((await handleDirectory(request("B".repeat(43)),env)).status,401);
    assert.equal(calls,0);
    assert.equal(await issueDirectoryGrant({...env,PROMOVIE_DIRECTORY_ENABLED:"false"},"owner",codeHash),null);
  }finally{globalThis.fetch=old;}
});
test("Catálogo real autoriza consulta após login, sem expor chaves e sem inventar nomes",async()=>{
  const {env}=makeEnvironment();
  const token=await issueDirectoryGrant(env,"beneficiary-test-1",codeHash);
  assert.match(token,/^[A-Za-z0-9_-]{43}$/);
  const old=globalThis.fetch;let called=0;
  globalThis.fetch=async(url,options)=>{
    called++;
    assert.equal(url,"https://sdk.mediquo.com/v1/consultants");
    assert.equal(options.method,"GET");
    assert.equal(options.headers["X-Secret-Key"],env.MEDIQUO_V3_SDK_SECRET_KEY);
    return Response.json({data:[
      {hash:"doctor-001",name:"Joana Souza",title:"Psychology",speciality_id:"20",status:"online"},
      {hash:"doctor-002",name:"Carlos Silva",title:"General Medicine",status:"offline"},
      {hash:"doctor-001",name:"Duplicado",title:"Duplicado"},
      {hash:"invalid<>",name:"Ataque",title:"X"},
      {hash:"doctor-003",name:"<script>",title:"Não incluir"}
    ]});
  };
  try{
    const r=await handleDirectory(request(token),env);
    assert.equal(r.status,200);
    const data=await r.json();
    assert.equal(data.available,true);
    assert.deepEqual(data.items.map(x=>[x.id,x.name,x.title]),[
      ["doctor-001","Joana Souza","Psychology"],["doctor-002","Carlos Silva","General Medicine"]
    ]);
    assert.equal(called,1);
    assert.ok(!JSON.stringify(data).includes(env.MEDIQUO_V3_SDK_SECRET_KEY));
    assert.ok(!JSON.stringify(data).includes("access_token"));
  }finally{globalThis.fetch=old;}
});
test("Fornecedor vazio ou fora do ar desabilita o diretório sem atrapalhar a consulta",async()=>{
  const {env}=makeEnvironment();
  const token=await issueDirectoryGrant(env,"owner",codeHash);
  const old=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({data:[]});
    let r=await handleDirectory(request(token),env);
    assert.equal(r.status,200);
    assert.deepEqual(await r.json(),{available:false,items:[]});
    globalThis.fetch=async()=>new Response("",{status:503});
    r=await handleDirectory(request(token),env);
    assert.equal(r.status,503);
    assert.deepEqual(await r.json(),{available:false});
    globalThis.fetch=async()=>{throw Error("offline");};
    assert.equal((await handleDirectory(request(token),env)).status,503);
  }finally{globalThis.fetch=old;}
});
test("Grant precisa estar vinculado à senha pessoal atual",async()=>{
  const {env}=makeEnvironment();
  const token=await issueDirectoryGrant(env,"owner","c".repeat(64));
  const old=globalThis.fetch;
  globalThis.fetch=()=>{throw Error("do not call");};
  try{
    assert.equal((await handleDirectory(request(token),env)).status,401);
  }finally{globalThis.fetch=old;}
});
