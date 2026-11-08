import {mkdir,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const origin="https://widget.mediquo.com";
const src=origin+"/js/1.0.0/mediquo.js";
const out="research/widget-routing-inspection.md";
const md=["# Inspeção do roteamento público da Médiquo","",
  "Somente código público, nenhuma sessão ou credencial do paciente.",""];
const needles=["open_room","professional_hash","open_list","navigate","/chat/","/room/","/professionals/","roomId","room_id","/launcher/","postMessage"];
async function get(url){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),14000);
  try{
    const r=await fetch(url,{signal:controller.signal,headers:{"Accept":"text/html,application/javascript,*/*"}});
    if(!r.ok)return {error:"HTTP "+r.status};
    const len=Number(r.headers.get("content-length")||0);
    if(len>4000000)return {error:"Arquivo muito grande: "+len};
    const text=await r.text();
    if(text.length>4000000)return {error:"Arquivo muito grande"};
    return {text,kind:r.headers.get("content-type")||"?"};
  }catch(e){return {error:String(e).slice(0,120)}}
  finally{clearTimeout(timer);}
}
function excerpts(text,search,max=4){
  const output=[],low=text.toLowerCase(),token=search.toLowerCase();
  let i=0;
  for(let n=0;n<max;n++){
    const at=low.indexOf(token,i);
    if(at<0)break;
    i=at+token.length;
    output.push({offset:at,context:text.slice(Math.max(0,at-210),Math.min(text.length,at+300)).replace(/[\n\r]+/g," ")});
  }
  return output;
}
function inspect(url,record){
  md.push("","## "+url);
  if(!record.text){md.push("- "+record.error);return}
  md.push("- tipo: "+record.kind,"- tamanho: "+record.text.length,
    "- sha256: "+createHash("sha256").update(record.text).digest("hex"));
  for(const key of needles){
    const matches=excerpts(record.text,key,3);
    if(matches.length)md.push("","### "+key,...matches.map(x=>"- "+x.offset+": "+x.context));
  }
}
const wrapper=await get(src);
inspect(src,wrapper);
if(wrapper.text){
  const js=wrapper.text;
  for(const k of ["createIframe:","init:","containerId:","launcherId:","case \"open_room\"","case \"navigate\""]){
    const matches=excerpts(js,k,2);
    md.push("","## Trechos do wrapper: "+k,...matches.map(x=>"- "+x.offset+": "+x.context));
  }
  const iframes=[...js.matchAll(/src:\s*([^\n,]{1,250})/g)].slice(0,15).map(x=>x[1]);
  md.push("","## URLs de iframes no código público",...iframes.map(x=>"- "+x));
}
for(const path of ["/launcher/index.html","/index.html","/container/index.html"]){
  const url=origin+path;
  const page=await get(url);
  inspect(url,page);
  if(!page.text)continue;
  const hits=[...page.text.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi)].slice(0,10).map(x=>x[1]);
  md.push("","### scripts carregados",...hits.map(x=>"- "+x));
  const selected=hits.filter(x=>/\.js(?:\?|$)/.test(x)).slice(0,3);
  for(const asset of selected){
    let full;try{full=new URL(asset,url);}catch{continue}
    if(full.hostname!=="widget.mediquo.com")continue;
    inspect(full.href,await get(full.href));
  }
}
md.push("","## Restrições da pesquisa","- Não tenta navegar em conversas de pacientes sem sessão autorizada.","- Não há escrita na API nem alterações de cadastros.");
await mkdir("research",{recursive:true});
await writeFile(out,md.join("\n")+"\n");
console.log("Pesquisa de roteamento concluída");
