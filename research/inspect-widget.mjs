import {createHash} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
const url="https://widget.mediquo.com/js/1.0.0/mediquo.js";
const output="research/widget-navigation-inspection.md";
const findings=["# Investigação isolada do Widget MediQuo","",
"Consulta somente ao arquivo JavaScript público. Sem login, CPF, dados clínicos ou credenciais do serviço.",""];
try{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  const response=await fetch(url,{headers:{Accept:"application/javascript,*/*"},signal:controller.signal,redirect:"follow"});
  clearTimeout(timer);
  findings.push("- Status HTTP do JS: "+response.status,"- Tipo de arquivo: "+(response.headers.get("content-type")||"não informado"));
  if(!response.ok)throw Error("HTTP "+response.status);
  const source=await response.text();
  findings.push("- Tamanho: "+source.length+" caracteres",
    "- SHA-256: "+createHash("sha256").update(source).digest("hex"));
  for(const needle of ["open_room","open_list","postMessage","professional_id","professionalId","professionals","room_id","roomId","sourceMappingURL"]){
    const positions=[];let start=0;
    while(start<source.length&&positions.length<8){
      const at=source.indexOf(needle,start);
      if(at===-1)break;
      positions.push(at);start=at+needle.length;
    }
    findings.push("","## "+needle+": "+(positions.length===8?"ao menos ":"")+positions.length+" ocorrência(s)");
    for(const offset of positions.slice(0,5)){
      const context=source.slice(Math.max(0,offset-170),Math.min(source.length,offset+240))
        .replace(/[\r\n]+/g," ");
      findings.push("- posição "+offset+": "+context);
    }
  }
  try{
    const {chromium}=await import("playwright");
    const browser=await chromium.launch({headless:true});
    try{
      const page=await browser.newPage();
      await page.goto("about:blank");
      await page.addScriptTag({url,timeout:25000});
      const data=await page.evaluate(()=>{
        const sdk=window.MediquoWidget;
        if(!sdk)return {global:false};
        const own=Object.getOwnPropertyNames(sdk);
        const methods={};
        for(const name of ["init","open","open_room","open_list"]){
          const method=sdk[name];
          methods[name]=typeof method==="function"?
            {present:true,source:Function.prototype.toString.call(method).slice(0,900)}:
            {present:false,type:typeof method};
        }
        return {global:true,own,methods};
      });
      findings.push("","## Inspeção do objeto JS sem autenticação","~~~json",JSON.stringify(data,null,2),"~~~");
      await page.close();
    }finally{await browser.close();}
  }catch(error){
    findings.push("","## Inspeção dinâmica indisponível","- "+String(error).slice(0,500));
  }
}catch(error){
  findings.push("","## Bloqueio de rede","- "+String(error).slice(0,400));
}
findings.push("","## Observações técnicas","- A existência do método não confirma abertura bem-sucedida.",
"- A lista de profissionais em produção requer sessão autenticada do paciente e não foi inspecionada.",
"- Não foram executadas operações da API, alterações cadastrais ou testes com beneficiários.");
await mkdir("research",{recursive:true});
await writeFile(output,findings.join("\n")+"\n");
console.log("Relatório gravado em "+output);
