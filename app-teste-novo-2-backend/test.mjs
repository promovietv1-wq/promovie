import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {setTimeout as sleep} from "node:timers/promises";
import {fileURLToPath} from "node:url";
import {dirname,join} from "node:path";
import {readFile} from "node:fs/promises";

const dir=dirname(fileURLToPath(import.meta.url));
async function freePort(){
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
async function jsonBody(req){
  const parts=[];for await(const part of req)parts.push(part);
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
async function runTest(){
  const records=[];
  const vendor=http.createServer(async(req,res)=>{
    records.push({url:req.url,header:req.headers["x-api-key"],body:await jsonBody(req)});
    res.writeHead(200,{"Content-Type":"application/json"});
    res.end(req.url.endsWith("/authenticate")?JSON.stringify({access_token:"mock-access-token"}):"{}");
  });
  await new Promise(resolve=>vendor.listen(0,"127.0.0.1",resolve));
  const vendorPort=vendor.address().port;
  const appPort=await freePort();
  const env={
    ...process.env,
    PORT:String(appPort),
    NODE_ENV:"test",
    MEDIQUO_API_KEY:"mock-public-api-key",
    MEDIQUO_SECRET_KEY:"mock-secret",
    MEDIQUO_TEST_PATIENT_CODE:"paciente-ficticio-001",
    PROMOVIE_TEST_PASSWORD:"senha-restrita-de-homologacao-123",
    ALLOWED_ORIGINS:"https://www.promovie.tv.br",
    MEDIQUO_BASE_URL:"http://127.0.0.1:"+vendorPort+"/v1"
  };
  const child=spawn(process.execPath,[join(dir,"server.mjs")],{env,stdio:"ignore"});
  const endpoint="http://127.0.0.1:"+appPort;
  try{
    let started=false;
    for(let i=0;i<70;i++){
      try{
        const health=await fetch(endpoint+"/api/mediquo/health");
        if(health.ok){started=true;break;}
      }catch{}
      await sleep(100);
    }
    assert.equal(started,true,"Backend deve iniciar com as variáveis de teste");
    const headers={Origin:"https://www.promovie.tv.br"};
    const c=await fetch(endpoint+"/api/mediquo/config",{headers});
    assert.equal(c.status,200);
    assert.equal(c.headers.get("access-control-allow-origin"),"https://www.promovie.tv.br");
    const config=await c.json();
    assert.equal(config.apiKey,"mock-public-api-key");
    assert.equal(JSON.stringify(config).includes("mock-secret"),false);

    const badOrigin=await fetch(endpoint+"/api/mediquo/config",{headers:{Origin:"https://site-nao-autorizado.invalid"}});
    assert.equal(badOrigin.status,403);

    const badPassword=await fetch(endpoint+"/api/mediquo/token",{
      method:"POST",headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({testPassword:"incorreta"})
    });
    assert.equal(badPassword.status,401);
    assert.equal(records.length,0,"Senha errada não deve chamar a Médiquo");

    const valid=await fetch(endpoint+"/api/mediquo/token",{
      method:"POST",headers:{...headers,"Content-Type":"application/json"},
      // Um code enviado pelo browser não deve substituir o paciente configurado no servidor.
      body:JSON.stringify({testPassword:env.PROMOVIE_TEST_PASSWORD,code:"vitima-externa"})
    });
    assert.equal(valid.status,200);
    assert.equal(valid.headers.get("cache-control"),"no-store");
    const body=await valid.json();
    assert.equal(body.access_token,"mock-access-token");
    assert.equal(JSON.stringify(body).includes("mock-secret"),false);
    assert.equal(records.length,2);
    assert.equal(records[0].url,"/v1/patients");
    assert.equal(records[1].url,"/v1/patients/authenticate");
    assert.equal(records[0].header,"mock-secret");
    assert.equal(records[0].body.patients[0].code,"paciente-ficticio-001");
    assert.equal(records[1].body.code,"paciente-ficticio-001");
    const front=await readFile(join(dir,"../app-teste-novo-2/index.html"),"utf8");
    assert.match(front,/accessToken:token.access_token/);
    // O front de homologação usa o domínio próprio do Worker já publicado.
    assert.match(front,/const BACKEND_URL="https:\/\/backend\.promovie\.tv\.br";/);
    assert.match(front,/title:"TeleSaúde"/);
    assert.doesNotMatch(front,/MEDIQUO_SECRET_KEY\s*=\s*["']/);
    assert.match(front,/Acessar telemedicina/);
  }finally{
    child.kill("SIGTERM");
    await new Promise(resolve=>vendor.close(resolve));
  }
}
test("Backend e frontend de homologação: segurança e emissão simulada de sessão",runTest);


test("Servidor sem credenciais: prévia segura, sem emissão de token",async()=>{
  const port=await freePort();
  const child=spawn(process.execPath,[join(dir,"server.mjs")],{
    env:{
      PORT:String(port),
      NODE_ENV:"production",
      ALLOWED_ORIGINS:"https://www.promovie.tv.br",
      MEDIQUO_TEST_PATIENT_CODE:"promovie-homologacao-001"
    },
    stdio:"ignore"
  });
  const base="http://127.0.0.1:"+port;
  try{
    let response=null;
    for(let i=0;i<50;i++){
      try{response=await fetch(base+"/api/mediquo/health");break;}catch{}
      await sleep(100);
    }
    assert.ok(response && response.ok,"Prévia deve iniciar mesmo sem as chaves");
    assert.equal((await response.json()).status,"aguardando-configuracao");
    const headers={Origin:"https://www.promovie.tv.br"};
    const config=await fetch(base+"/api/mediquo/config",{headers});
    assert.equal(config.status,503);
    assert.deepEqual(await config.json(),{error:"Ambiente de testes ainda não configurado."});
    const token=await fetch(base+"/api/mediquo/token",{
      method:"POST",
      headers:{...headers,"Content-Type":"application/json"},
      body:JSON.stringify({testPassword:"qualquer"})
    });
    assert.equal(token.status,503);
    assert.equal((await token.json()).error,"Ambiente de testes ainda não configurado.");
  }finally{
    child.kill("SIGTERM");
  }
});
