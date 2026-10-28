// PromoVie / Médiquo - Somente homologação: um paciente fictício e senha de teste.
// Adaptação segura do fluxo backend do kit enviado pela Médiquo.
// IMPORTANTE: esta rota não implementa login de beneficiários nem autoriza uso em produção.
import http from "node:http";
import crypto from "node:crypto";

const env=process.env;
const PORT=Number(env.PORT||3000);
const apiKey=(env.MEDIQUO_API_KEY||"").trim();
const secret=(env.MEDIQUO_SECRET_KEY||"").trim();
const password=env.PROMOVIE_TEST_PASSWORD||"";
const patientCode=(env.MEDIQUO_TEST_PATIENT_CODE||"").trim();
const base=(env.MEDIQUO_BASE_URL||"").trim().replace(/\/+$/,"");
const plan=(env.MEDIQUO_TEST_PLAN||"").trim();
const allowed=new Set((env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean));

// Permite publicar uma prévia segura e GRATUITA mesmo antes da Médiquo
// confirmar a URL e as credenciais de homologação. Nenhum token é emitido
// enquanto a configuração privada não estiver completa.
const configured=Boolean(apiKey&&secret&&password.length>=16&&patientCode&&allowed.size&&base);
if(!configured){
  console.warn("Aguardando configuração privada do ambiente de homologação.");
}
if(!Number.isInteger(PORT)||PORT<1||PORT>65535){
  console.error("PORT inválida.");process.exit(1);
}
if(base && !base.startsWith("https://") && !(env.NODE_ENV!=="production" && /^http:\/\/(127\.0\.0\.1|localhost):\d+/.test(base))){
  console.error("A URL da API Médiquo deve usar HTTPS (exceto testes locais).");
  process.exit(1);
}


// Evita que o teste de homologação utilize acidentalmente o endpoint de produção
// do exemplo enviado pelo fornecedor. Solicite ao Pedro o endpoint de Staging.
if(/^https:\/\/sdk\.mediquo\.com\/v1\/?$/i.test(base)){
  console.error("URL de produção não permitida neste backend exclusivo de homologação.");
  process.exit(1);
}

const passDigest=crypto.createHash("sha256").update(password).digest();
const attempts=new Map();
const WINDOW_MS=15*60*1000;
const MAX_ATTEMPTS=8;

function reply(res,status,body){
  res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  res.end(JSON.stringify(body));
}
function passMatch(input){
  if(typeof input!=="string")return false;
  const test=crypto.createHash("sha256").update(input).digest();
  return crypto.timingSafeEqual(test,passDigest);
}
async function receiveJson(req){
  let size=0;const parts=[];
  for await(const part of req){
    size+=part.length;
    if(size>2048){const e=new Error("Corpo excede o limite.");e.status=413;throw e;}
    parts.push(part);
  }
  try{return JSON.parse(Buffer.concat(parts).toString("utf8"));}
  catch{const e=new Error("JSON inválido.");e.status=400;throw e;}
}
async function vendorPost(path,payload){
  const response=await fetch(base+path,{
    method:"POST",
    headers:{"Content-Type":"application/json","X-API-Key":secret},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(18000)
  });
  if(!response.ok){
    // Não encaminhar ao visitante mensagens potencialmente sensíveis do fornecedor.
    console.error("Médiquo retornou HTTP",response.status,"em",path);
    const e=new Error("Falha de integração com Médiquo.");e.status=502;throw e;
  }
  if(path==="/patients/authenticate"){
    try{return await response.json();}
    catch{const e=new Error("Resposta inválida do fornecedor.");e.status=502;throw e;}
  }
  return null;
}
function limited(ip){
  const now=Date.now();
  for(const [key,value] of attempts){if(now-value.since>WINDOW_MS)attempts.delete(key);}
  const value=attempts.get(ip);
  if(!value){attempts.set(ip,{since:now,count:1});return false;}
  value.count++;
  return value.count>MAX_ATTEMPTS;
}

const server=http.createServer(async(req,res)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","no-referrer");
  res.setHeader("X-Frame-Options","DENY");
  const origin=req.headers.origin;
  if(origin){
    if(!allowed.has(origin))return reply(res,403,{error:"Origem não autorizada."});
    res.setHeader("Access-Control-Allow-Origin",origin);
    res.setHeader("Vary","Origin");
    res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type");
  }
  if(req.method==="OPTIONS"){res.writeHead(204);res.end();return;}
  const route=(req.url||"").split("?")[0];
  if(req.method==="GET"&&route==="/api/mediquo/health"){
    return reply(res,200,{status:configured?"ok":"aguardando-configuracao",mode:"homologacao-restrita"});
  }
  if(req.method==="GET"&&route==="/api/mediquo/config"){
    // Apenas API Key pública. Nenhuma Secret Key sai deste servidor.
    if(!configured)return reply(res,503,{error:"Ambiente de testes ainda não configurado."});
    return reply(res,200,{apiKey});
  }
  if(req.method==="POST"&&route==="/api/mediquo/token"){
    if(!configured)return reply(res,503,{error:"Ambiente de testes ainda não configurado."});
    const ip=req.socket.remoteAddress||"unknown";
    if(limited(ip))return reply(res,429,{error:"Limite de tentativas. Tente mais tarde."});
    try{
      const data=await receiveJson(req);
      if(!passMatch(data?.testPassword))return reply(res,401,{error:"Senha de teste inválida."});
      const patient={code:patientCode,first_name:"Paciente",last_name:"Homologacao"};
      if(plan)patient.plan=plan;
      await vendorPost("/patients",{patients:[patient]});
      const auth=await vendorPost("/patients/authenticate",{code:patientCode});
      const accessToken=auth?.access_token||auth?.data?.access_token;
      if(typeof accessToken!=="string"||!accessToken){
        console.error("Médiquo não retornou token de sessão.");
        return reply(res,502,{error:"A Médiquo não retornou o token de atendimento."});
      }
      return reply(res,200,{access_token:accessToken});
    }catch(e){
      if(e.name==="TimeoutError")return reply(res,504,{error:"Tempo de resposta da Médiquo excedido."});
      if(e.status===400||e.status===413)return reply(res,e.status,{error:e.message});
      console.error("Falha no fluxo de token:",e.message);
      return reply(res,e.status||500,{error:"Não foi possível validar o atendimento no servidor."});
    }
  }
  reply(res,404,{error:"Rota não encontrada."});
});

server.listen(PORT,()=>console.log("Backend de homologação PromoVie ativo na porta",PORT));
