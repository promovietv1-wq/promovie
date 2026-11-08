import {mkdir,writeFile} from "node:fs/promises";
const url="https://widget.mediquo.com/assets/main.222d2998.js";
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),15000);
let src="";
try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error("HTTP "+response.status);
  src=await response.text();
  if(src.length>3000000)throw Error("Bundle muito grande");
}finally{clearTimeout(timeout);}
const md=["# Mapeamento do roteamento no aplicativo de atendimento","",
 "Leitura de código JS público, sem nenhuma sessão de paciente.","",
 "- Bundle: "+url,"- Tamanho: "+src.length,""];
const patterns=["case\"open_room\"","professionalHash","setProfessionalHash",
  "professional_hash","/professionals/"+String.fromCharCode(36,123),"/professionals/:","/professionals/",
  "open_room","case\"navigate\"","path:\"/\"","hash}/room"];
for(const token of patterns){
  const indexes=[],lower=src.toLowerCase(),key=token.toLowerCase();let pos=0;
  while(indexes.length<25){
    const at=lower.indexOf(key,pos);
    if(at<0)break;indexes.push(at);pos=at+key.length;
  }
  md.push("","## "+token+" ("+indexes.length+(indexes.length===25?"+":"")+")");
  for(const at of indexes.slice(0,13)){
    md.push("- "+at+": "+src.slice(Math.max(0,at-300),Math.min(src.length,at+550)).replace(/[\n\r]+/g," "));
  }
}
await mkdir("research",{recursive:true});
await writeFile("research/widget-routing-deep.md",md.join("\n")+"\n");
console.log("Relatório do roteamento gerado");
