import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {issueDirectoryGrant,handleDirectory,projectPatientProfessionals,combineAuthorizedProfiles} from "./src/directory.mjs";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const origin="https://www.promovie.tv.br",accessHash="b".repeat(64);
const sdkToken="TEST-PATIENT-SDK-JWT-TOKEN-WITH-FAKE-CONTENT";
function harness(){
  const sessions=new Map();
  const db={async exec(){return {success:true};},prepare(sql){
    let args=[];
    return {bind(...v){args=v;return this;},
      async run(){
        if(sql.startsWith("INSERT INTO pv_directory_sessions_v2"))
          sessions.set(args[0],{access_hash:args[2],sdk_hash:args[3],expires_at:args[4]});
        return {success:true};
      },
      async first(){
        assert.match(sql,/FROM pv_directory_sessions_v2/);
        const s=sessions.get(args[0]);
        return s&&s.expires_at>args[1]?{access_hash:s.access_hash,sdk_hash:s.sdk_hash,
          code_hash:accessHash,pending_hash:null}:null;
      }};
  }};
  return {sessions,env:{
    PROMOVIE_DIRECTORY_ENABLED:"true",PROMOVIE_BENEFICIARIOS_DB:db,
    ALLOWED_ORIGINS:origin,MEDIQUO_V3_PLAN:"345",
    MEDIQUO_V3_BASE_URL:"https://sdk.mediquo.com/v1",
    MEDIQUO_V3_WIDGET_API_KEY:"WIDGET-TEST-PUBLIC",
    TELESAUDE_V3_SYNC_TOKEN:"SIMULATED-SESSION-PEPPER-123456789"
  }};
}
function req(grant,token=sdkToken,originHeader=origin,profile=false){
  return new Request("https://backend.promovie.tv.br/api/promovie/directory/v1/"+(profile?"catalog-profile":"catalog"),{
    method:"POST",headers:{Origin:originHeader,"Content-Type":"application/json",Authorization:"Bearer "+grant},
    body:JSON.stringify({sdk_access_token:token})
  });
}
test("Sem autorização ou com token de outro paciente nunca chama a API",async()=>{
  const {env}=harness();const grant=await issueDirectoryGrant(env,"test-beneficiary",accessHash,sdkToken);
  assert.match(grant,/^[A-Za-z0-9_-]{43}$/);
  const old=globalThis.fetch;let calls=0;
  globalThis.fetch=()=>{calls++;throw Error("unexpected");};
  try{
    assert.equal((await handleDirectory(req("A".repeat(43)),env)).status,401);
    assert.equal((await handleDirectory(req(grant,"OTHER-PATIENT-ACCESS-TOKEN-EXAMPLE"),env)).status,401);
    assert.equal((await handleDirectory(req(grant,sdkToken,"https://other.example"),env)).status,403);
    assert.equal((await handleDirectory(req(grant,sdkToken),{...env,PROMOVIE_DIRECTORY_ENABLED:"false"})).status,503);
    assert.equal(calls,0);
  }finally{globalThis.fetch=old;}
});
test("Consulta apenas os profissionais realmente elegíveis para o paciente autenticado",async()=>{
  const {env}=harness();const grant=await issueDirectoryGrant(env,"owner",accessHash,sdkToken);
  const old=globalThis.fetch;let count=0;
  globalThis.fetch=async(url,options)=>{
    count++;
    assert.equal(url,"https://sdk.mediquo.com/v1/professionals");
    assert.equal(options.method,"GET");
    assert.equal(options.headers.Authorization,"Bearer "+sdkToken);
    assert.equal(options.headers["X-API-Key"],env.MEDIQUO_V3_WIDGET_API_KEY);
    assert.equal(options.headers["X-Secret-Key"],undefined);
    return Response.json({data:[
      {hash:"doctor-01",name:"Joana Souza",title:"Psychology",is_available:true,status:"online"},
      {hash:"doctor-02",name:"Carlos Silva",title:"General Medicine",is_available:false,status:"offline"},
      {hash:"doctor-03",name:"Ana Pereira",title:"Nutrition",is_available:true,status:"offline"},
      {hash:"doctor-01",name:"Duplicado",title:"Psychology",is_available:true},
      {hash:"unsafe<>",name:"Ataque",title:"Psicologia",is_available:true}
    ]});
  };
  try{
    const res=await handleDirectory(req(grant),env);
    assert.equal(res.status,200);
    const data=await res.json();
    assert.equal(data.available,true);
    assert.deepEqual(data.items.map(x=>[x.id,x.name,x.title]),
      [["doctor-01","Joana Souza","Psychology"],["doctor-03","Ana Pereira","Nutrition"]]);
    assert.equal(count,1);
    assert.ok(!JSON.stringify(data).includes(sdkToken));
  }finally{globalThis.fetch=old;}
});
test("Disponibilidade explicitamente negada não retorna profissionais",async()=>{
  const {env}=harness();const grant=await issueDirectoryGrant(env,"owner",accessHash,sdkToken);
  const old=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({data:[
      {hash:"doctor-01",name:"Joana Souza",title:"Psychology",is_available:false}
    ]});
    let r=await handleDirectory(req(grant),env);
    assert.equal(r.status,200);
    assert.deepEqual(await r.json(),{available:false,items:[]});
    globalThis.fetch=async()=>new Response("",{status:503});
    r=await handleDirectory(req(grant),env);
    assert.equal(r.status,503);
    assert.deepEqual(await r.json(),{available:false});
  }finally{globalThis.fetch=old;}
});
test("Projeta dados autorizados sem HTML, duplicados ou campos sensíveis",()=>{
  const data=projectPatientProfessionals({data:[
    {hash:"1",name:" Dr. José ",title:" Psicologia ",is_available:true,room:{messages:["privado"]}},
    {hash:"2",name:"Pessoa não elegível",title:"Clínico",is_available:false},
    {hash:"3",name:"Não validado",title:"Clínico"},
    {hash:"4",name:"<script>",title:"Clínico",is_available:true}
  ]});
  assert.deepEqual(data,[
    {id:"1",name:"Dr. José",title:"Psicologia",status:null},
    {id:"3",name:"Não validado",title:"Clínico",status:null}
  ]);
  assert.ok(!JSON.stringify(data).includes("privado"));
});

test("Profissionais retornados sem is_available são preservados e perfis são saneados",()=>{
  const data=projectPatientProfessionals({data:[
    {hash:"safe-1",name:"Dra. Maria",title:"Dermatologia",status:"offline",
      description:"Atendimento clínico e orientação em saúde.",
      avatar:"https://api.mediquo.com/img/profile.png",speciality_id:"11",
      chat:{messages:["DADO CLINICO PRIVADO"]}},
    {hash:"safe-2",name:"Dr. Pedro",title:"Pediatria",is_available:false},
    {hash:"safe-3",name:"Dra. Ana",title:"Psicologia",is_available:true,
      description:"<script>alert(1)</script>",avatar:"https://example.org/avatar.jpg"}
  ]});
  assert.equal(data.length,2);
  assert.deepEqual(data[0],{
    id:"safe-1",name:"Dra. Maria",title:"Dermatologia",status:"offline",
    description:"Atendimento clínico e orientação em saúde.",
    avatar:"https://api.mediquo.com/img/profile.png",speciality_id:"11"
  });
  assert.deepEqual(data[1],{id:"safe-3",name:"Dra. Ana",title:"Psicologia",status:null});
  assert.ok(!JSON.stringify(data).includes("PRIVADO"));
  assert.ok(!JSON.stringify(data).includes("<script>"));
});


test("Perfil público expandido usa mesma autorização e conserva o catálogo anterior intacto",async()=>{
  const {env}=harness(),grant=await issueDirectoryGrant(env,"owner",accessHash,sdkToken);
  const previous=globalThis.fetch;let calls=0;
  globalThis.fetch=async(url,options)=>{
    calls++;
    assert.equal(url,"https://sdk.mediquo.com/v1/professionals");
    assert.equal(options.headers.Authorization,"Bearer "+sdkToken);
    return Response.json({data:[
      {hash:"doctor-01",name:"Dra. Alicia Rodrigues",title:"Psicologia",
       description:"Psicóloga clínica. Trabalho com terapia do esquema e autoconhecimento. ".repeat(12),
       avatar:"/public/doctor-01.jpg",collegiate_number:"CRP-04/77069",status:"online",
       languages:["Português"],is_available:true,
       private_notes:"DADO SENSIVEL",room:{messages:["NAO EXPORTAR"]}},
      {hash:"doctor-02",name:"Dr. Restrito",title:"Psicologia",is_available:false},
      {hash:"doctor-03",name:"Dr. Sem imagem",title:"Dermatologia",
       avatar:"https://tracker.example.org/photo.jpg",
       description:"Atendimento dermatológico."}
    ]});
  };
  try{
    assert.equal((await handleDirectory(req("A".repeat(43),sdkToken,origin,true),env)).status,401);
    assert.equal((await handleDirectory(req(grant,"OTHER-USER-FAKE-SDK-EXAMPLE",origin,true),env)).status,401);
    assert.equal((await handleDirectory(req(grant,sdkToken,"https://attacker.example",true),env)).status,403);
    const r=await handleDirectory(req(grant,sdkToken,origin,true),env);
    assert.equal(r.status,200);
    const data=await r.json();
    assert.equal(data.items.length,2);
    assert.equal(data.items[0].avatar,"https://api.mediquo.com/public/doctor-01.jpg");
    assert.equal(data.items[0].collegiate_number,"CRP-04/77069");
    assert.ok(data.items[0].description.length>500);
    assert.deepEqual(data.items[0].languages,["Português"]);
    assert.equal(data.items[1].avatar,"https://tracker.example.org/photo.jpg");
    assert.ok(!JSON.stringify(data).includes("DADO SENSIVEL"));
    assert.ok(!JSON.stringify(data).includes("NAO EXPORTAR"));
    const legacy=await (await handleDirectory(req(grant),env)).json();
    assert.equal(legacy.items[0].collegiate_number,undefined);
    assert.equal(legacy.items[0].avatar,undefined);
    assert.equal(legacy.items[0].description.length,500);
    assert.equal(calls,2);
  }finally{globalThis.fetch=previous;}
});


test("Novo perfil une apenas profissionais autorizados, usando consultores documentados",async()=>{
  const {env}=harness();
  env.MEDIQUO_V3_SDK_SECRET_KEY="TEST-SECRET-BACKEND-ONLY";
  const grant=await issueDirectoryGrant(env,"owner",accessHash,sdkToken);
  let primaryCalls=0,consultantCalls=0;
  const previous=globalThis.fetch;
  globalThis.fetch=async(url,options)=>{
    if(url==="https://sdk.mediquo.com/v1/professionals"){
      primaryCalls++;
      assert.equal(options.headers.Authorization,"Bearer "+sdkToken);
      assert.equal(options.headers["X-Secret-Key"],undefined);
      return Response.json({data:[
        {hash:"doctor-alice",name:"Alicia Rodrigues",title:"Psicologia",
          status:"online",description:"",avatar:null},
        {hash:"doctor-ana",name:"Ana Paula",title:"Nutrição",
          is_available:false},
        {hash:"doctor-portrait",name:"Dra. Olga",title:"Dermatologia"}
      ]});
    }
    if(url==="https://sdk.mediquo.com/v1/consultants"){
      consultantCalls++;
      assert.equal(options.headers["X-API-Key"],env.MEDIQUO_V3_WIDGET_API_KEY);
      assert.equal(options.headers["X-Secret-Key"],env.MEDIQUO_V3_SDK_SECRET_KEY);
      assert.equal(options.headers.Authorization,undefined);
      return Response.json({data:[
        {hash:"doctor-alice",name:"Alicia Rodrigues",title:"Psicologia",
          description:"<p>Psicóloga clínica, formada em atendimento terapêutico.</p>"+
            "<p>Especializada em terapia do esquema.</p>",
          avatar:"https://cdn.example-cdn.net/alicia.png",
          collegiate_number:"CRP-04/77069",languages:["Português"],
          notes:{private:"NAO EXIBIR"}},
        {hash:"doctor-ana",name:"Ana Paula",title:"Nutrição",
          description:"ESSE PROFISSIONAL NÃO É ELEGÍVEL"},
        {hash:"doctor-intruder",name:"Outra Pessoa",title:"Psicologia",
          description:"NÃO PODE APARECER"},
        {hash:"doctor-portrait",name:"Dra. Olga",title:"Dermatologia",
          avatar:"http://insecure.example.org/olga.png",
          description:"<script>alert(1)</script>Dermatologista clínica."}
      ]});
    }
    throw Error("Endpoint inesperado");
  };
  try{
    const resp=await handleDirectory(req(grant,sdkToken,origin,true),env);
    assert.equal(resp.status,200);
    const data=await resp.json();
    assert.equal(data.items.length,2);
    assert.deepEqual(data.items.map(p=>p.id),["doctor-alice","doctor-portrait"]);
    assert.equal(data.items[0].avatar,"https://cdn.example-cdn.net/alicia.png");
    assert.match(data.items[0].description,/Psicóloga clínica/);
    assert.match(data.items[0].description,/terapia do esquema/);
    assert.equal(data.items[0].collegiate_number,"CRP-04/77069");
    assert.deepEqual(data.items[0].languages,["Português"]);
    assert.equal(data.items[1].avatar,undefined);
    assert.equal(data.items[1].description,"Dermatologista clínica.");
    assert.equal(data.profileData.photos,1);
    assert.equal(data.profileData.descriptions,2);
    assert.equal(data.profileData.supplierProfileAvailable,true);
    assert.equal(consultantCalls,1);
    assert.equal(primaryCalls,1);
    assert.ok(!JSON.stringify(data).includes("NAO EXIBIR"));
    assert.ok(!JSON.stringify(data).includes("NÃO PODE APARECER"));
    // A versão anterior permanece usando exatamente o catálogo do paciente.
    await handleDirectory(req(grant),env);
    assert.equal(primaryCalls,2);
    assert.equal(consultantCalls,1);
  }finally{globalThis.fetch=previous;}
});

test("Resposta vazia ou falha da API de consultores não derruba os atendimentos",async()=>{
  const {env}=harness();
  env.MEDIQUO_V3_SDK_SECRET_KEY="TEST-SECRET-BACKEND-ONLY";
  const grant=await issueDirectoryGrant(env,"owner",accessHash,sdkToken);
  const before=globalThis.fetch;
  globalThis.fetch=async(url)=>{
    if(url.endsWith("/professionals"))
      return Response.json({data:[{hash:"doctor-1",name:"Dra. Maria",title:"Psicologia"}]});
    if(url.endsWith("/consultants"))
      return new Response("",{status:403});
    throw Error("Unexpected call");
  };
  try{
    const r=await handleDirectory(req(grant,sdkToken,origin,true),env);
    assert.equal(r.status,200);
    const value=await r.json();
    assert.deepEqual(value.items.map(p=>p.name),["Dra. Maria"]);
    assert.equal(value.profileData.supplierProfileAvailable,false);
    assert.equal(value.profileData.photos,0);
  }finally{globalThis.fetch=before;}
});

test("Enriquecimento não concede acesso a novos profissionais",()=>{
  const scoped=[{id:"abc",name:"Maria",title:"Psicologia",status:"online"}];
  const secondary={data:[{hash:"other",name:"Intruso",title:"Psicologia",
    description:"Não autorizado"}]};
  assert.deepEqual(combineAuthorizedProfiles(scoped,secondary),scoped);
});
