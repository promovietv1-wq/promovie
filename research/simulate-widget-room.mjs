import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const browser=await chromium.launch({headless:true});
const report=["# Experiência isolada com o widget público real","",
"Autenticação e dados do paciente integralmente simulados. Nenhuma credencial ou sessão real utilizada.",""];
const fake={hash:"test-professional-01",name:"Dra. Exemplo Teste",title:"Psychology",is_available:true,status:"online",
  room:null,avatar:null,description:"",speciality_id:"20"};
try{
  const page=await browser.newPage({viewport:{width:390,height:840}});
  const requests=[],messages=[],errors=[];
  page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text().slice(0,170));});
  page.on("pageerror",error=>errors.push(String(error).slice(0,170)));
  await page.addInitScript(()=>{window.__events=[];window.addEventListener("message",e=>{
    if(e.origin!=="https://widget.mediquo.com")return;
    if(window.__events.length<100)window.__events.push({
      command:e.data?.command||"",payload:typeof e.data?.payload==="string"?e.data.payload.slice(0,90):undefined
    });
  });});
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==="sdk.mediquo.com"){
      requests.push({method:req.method(),path:url.pathname});
      if(req.method()!=="GET")return route.abort();
      if(url.pathname==="/v1/professionals")
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:[fake]})});
      if(url.pathname.startsWith("/v1/professionals/"))
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:fake})});
      if(url.pathname==="/v1/profile")
        return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:{
          hash:"test-patient-01",first_name:"Paciente",last_name:"Exemplo",gdpr_accepted:true,locale:"pt"
        }})});
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({data:{}})});
    }
    if(["chat.mediquo.com","chat-server.mediquo.com","tracking.mediquo.com"].includes(url.hostname)){
      requests.push({method:req.method(),path:url.pathname,host:url.hostname});
      return route.abort();
    }
    return route.continue();
  });
  await page.goto("https://www.promovie.tv.br/telesaude/",{waitUntil:"domcontentloaded",timeout:25000});
  await page.addScriptTag({url:"https://widget.mediquo.com/js/1.0.0/mediquo.js",timeout:20000});
  const init=await page.evaluate(()=>Promise.race([
    window.MediquoWidget.init({
      apiKey:"FAKE-PUBLIC-KEY-FOR-LAB",accessToken:"FAKE-SDK-TOKEN-LAB-ONLY",
      adapter:"web",environment:"production",show:"always",isMobileView:true,
      theme:{launcher:"hidden",locale:"pt"}
    }).then(()=>"resolved",e=>"rejected: "+String(e).slice(0,130)),
    new Promise(resolve=>setTimeout(()=>resolve("timeout"),12000))
  ]));
  await page.waitForTimeout(2700);
  const before=page.frames().map(f=>f.url()).filter(x=>x.includes("widget.mediquo.com"));
  await page.evaluate(()=>window.MediquoWidget.open_room("test-professional-01"));
  await page.waitForTimeout(3200);
  const after=page.frames().map(f=>f.url()).filter(x=>x.includes("widget.mediquo.com"));
  const events=await page.evaluate(()=>window.__events);
  report.push("- Inicialização do SDK: "+init,"- Iframes antes: "+JSON.stringify(before),
    "- Iframes após open_room: "+JSON.stringify(after),
    "- Navegação para room comprovada no ambiente simulado: "+after.some(x=>x.includes("/professionals/test-professional-01/room")),
    "- Chamadas API simuladas: "+JSON.stringify(requests.slice(0,35)),
    "- Eventos sanitizados: "+JSON.stringify(events.slice(0,35)),
    "- Erros não sensíveis: "+JSON.stringify(errors.slice(0,20)));
  await page.close();
}catch(error){report.push("","## Falha no ambiente simulado","- "+String(error).slice(0,400));}
finally{await browser.close();}
report.push("","O teste simulado **não confirma** o acesso de profissionais por pacientes reais na produção.");
await mkdir("research",{recursive:true});
await writeFile("research/widget-simulated-room-test.md",report.join("\n")+"\n");
console.log("Teste isolado finalizado");
