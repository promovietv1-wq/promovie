/* Homologação isolada PromoVie: apenas dados reais da sessão autenticada.
   Nunca inventa profissionais, grava mensagens ou modifica o SDK MediQuo.
   Os dois métodos de navegação são alternativas MANUAIS e explicitamente testáveis. */
const ORDER=[
 ["Clínico geral",/clinico|medicin(a|e) general|general (medic|pract|doctor)|primary care|family medic/],
 ["Psicologia",/psicolog|psycholog|psicoterap|mental health/],
 ["Nutrição",/nutric|nutrit|dietetic|dietitian/],
 ["Treinamento físico",/trein|entren|physical train|fitness|educa(cao|dor) fisic|personal train|preparac(ao|ion) fisic/],
 ["Pediatria",/pediatr|paediatr/],
 ["Dermatologia",/dermat/],
 ["Ginecologia",/ginecol|gynecol|gynaecol/],
 ["Veterinária",/veterinar|veterinary/]
];
const ENDPOINT="https://backend.promovie.tv.br/api/promovie/directory/v1/catalog";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
const category=p=>{
 const label=norm(p.title);
 for(const [name,pattern] of ORDER)if(pattern.test(label))return name;
 return "Outras especialidades";
};
const allowed=p=>p&&/^[A-Za-z0-9_-]{1,128}$/.test(p.id||"")&&
 typeof p.name==="string"&&p.name.trim().length>=2&&p.name.length<=90&&
 typeof p.title==="string"&&p.title.length<=90;
export async function initDirectory(widget,grant,accessToken){
 const el=id=>document.getElementById(id);
 const button=el("directory-open"),dialog=el("directory-dialog"),query=el("directory-query");
 const results=el("directory-results"),message=el("directory-feedback");
 const close=el("directory-close"),alt=el("directory-alternative");
 const diagnostics=el("directory-diagnostics"),copy=el("directory-copy-status");
 if(!button||!dialog||!query||!results||!message||!close||!alt||!diagnostics||!copy)return false;
 let catalog=[],state="iniciando",lastPerson=null,lastAttempt=null,busy=false;
 const report=[];
 const tell=(status,text)=>{
   state=status;message.textContent=text;diagnostics.textContent="Diagnóstico: "+status;
   report.push(status);
 };
 button.hidden=false;
 button.addEventListener("click",()=>{
   query.value="";render();alt.hidden=true;
   if(!dialog.open&&typeof dialog.showModal==="function")dialog.showModal();
   query.focus();
 });
 close.addEventListener("click",()=>{if(dialog.open)dialog.close();});
 dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
 copy.addEventListener("click",()=>{
   const text="Telessaúde PromoVie | Teste de profissionais\n"+
     "Estado: "+state+"\nProfissionais encontrados: "+catalog.length+
     "\nÚltimo método: "+(lastAttempt||"nenhum")+"\nSem CPF, senha ou token.";
   navigator.clipboard?.writeText(text).then(()=>{
     diagnostics.textContent="Diagnóstico copiado. Não contém dados de acesso.";
   }).catch(()=>{diagnostics.textContent="Não foi possível copiar automaticamente.";});
 });
 function render(){
   const q=norm(query.value),visible=catalog.filter(p=>norm([p.name,p.title,p.category].join(" ")).includes(q));
   results.replaceChildren();
   for(const groupName of [...ORDER.map(x=>x[0]),"Outras especialidades"]){
     const group=visible.filter(p=>p.category===groupName)
       .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
     if(!group.length)continue;
     const section=document.createElement("section");section.className="directory-section";
     const title=document.createElement("h3");title.textContent=groupName;section.append(title);
     const list=document.createElement("div");list.className="directory-list";
     for(const p of group){
       const item=document.createElement("button");item.type="button";
       item.className="directory-person";item.dataset.id=p.id;
       const content=document.createElement("span"),name=document.createElement("strong");
       name.textContent=p.name;content.append(name);
       if(p.title&&norm(p.title)!==norm(groupName)){
         const subtitle=document.createElement("small");subtitle.textContent=p.title;content.append(subtitle);
       }
       const chevron=document.createElement("span");chevron.className="directory-chevron";
       chevron.setAttribute("aria-hidden","true");item.append(content,chevron);list.append(item);
     }
     section.append(list);results.append(section);
   }
   if(catalog.length&&visible.length===0)tell("sem-resultados","Nenhum nome corresponde à pesquisa.");
 }
 query.addEventListener("input",render);
 function awaitVendorSignal(hash,timeoutMs=6500){
   return new Promise(resolve=>{
     let done=false;
     const frame=document.getElementById("MediquoContainer");
     function finish(ok){
       if(done)return;
       done=true;window.removeEventListener("message",onMessage);clearTimeout(timer);resolve(ok);
     }
     function onMessage(event){
       if(event.origin!=="https://widget.mediquo.com"||
          event.source!==frame?.contentWindow)return;
       const data=event.data;
       if(data?.command!=="message")return;
       const found=data.payload?.professional?.hash;
       if(found===hash)finish(true);
     }
     const timer=setTimeout(()=>finish(false),timeoutMs);
     window.addEventListener("message",onMessage);
   });
 }
 async function attempt(person,method){
   if(!person||busy)return;
   busy=true;lastPerson=person;lastAttempt=method;alt.hidden=true;
   tell("abrindo-"+method,"Enviando solicitação à Médiquo e aguardando confirmação...");
   try{
     // A promessa de confirmação vem de um evento do IFRAME; open_room retorna void.
     const confirmation=awaitVendorSignal(person.id);
     if(method==="navigate"){
       if(typeof widget.navigate!=="function")throw Error("navigate não disponível");
       widget.navigate("/professionals/"+encodeURIComponent(person.id)+"/room");
     }else{
       if(typeof widget.open_room!=="function")throw Error("open_room não disponível");
       widget.open_room(person.id);
     }
     if(await confirmation){
       tell("conversa-confirmada-"+method,
         "A Médiquo sinalizou o profissional selecionado. Confira a conversa no aplicativo.");
       dialog.close();
     }else{
       tell("sem-confirmacao-"+method,
         "O aplicativo não confirmou a abertura desta conversa. A seleção pode ter retornado à lista.");
       alt.hidden=method!=="navigate"||typeof widget.open_room!=="function";
     }
   }catch{
     tell("metodo-indisponivel-"+method,
       "Este método não está disponível nesta versão do aplicativo.");
     alt.hidden=method!=="navigate"||typeof widget.open_room!=="function";
   }finally{busy=false;}
 }
 results.addEventListener("click",e=>{
   const item=e.target.closest("button.directory-person");
   if(!item||busy)return;
   const person=catalog.find(p=>p.id===item.dataset.id);
   if(person)attempt(person,"navigate");
 });
 alt.addEventListener("click",()=>{if(lastPerson&&!busy)attempt(lastPerson,"open_room");});
 tell("carregando","Consultando os profissionais reais autorizados para sua conta...");
 if(!/^[A-Za-z0-9_-]{43}$/.test(grant||"")||
    typeof accessToken!=="string"||accessToken.length<24){
   tell("sessao-sem-permissao","O login não liberou a consulta experimental. O atendimento normal continua disponível.");
   return false;
 }
 try{
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),11000);
   let response;
   try{
     response=await fetch(ENDPOINT,{
       method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+grant},
       body:JSON.stringify({sdk_access_token:accessToken}),
       cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",signal:controller.signal
     });
   }finally{clearTimeout(timeout);}
   if(!response.ok){
     tell("catalogo-http-"+response.status,
       "Não foi possível consultar a lista real. Código de resposta: "+response.status+".");
     return false;
   }
   const data=await response.json();
   if(!Array.isArray(data?.items))throw Error("Formato inesperado");
   const seen=new Set();
   catalog=data.items.filter(p=>{
     if(!allowed(p)||seen.has(p.id))return false;seen.add(p.id);return true;
   }).slice(0,160).map(p=>({id:p.id,name:p.name.trim(),title:p.title.trim(),category:category(p)}));
   render();
   if(!catalog.length)tell("catalogo-vazio",
     "A Médiquo não retornou profissionais elegíveis para este acesso. Nenhuma lista foi inventada.");
   else tell("catalogo-real-"+catalog.length,
     "Encontrados "+catalog.length+" profissionais autorizados. Selecione um para testar.");
   return catalog.length>0;
 }catch{
   tell("erro-consulta","A consulta experimental não respondeu. O atendimento original não foi alterado.");
   return false;
 }
}
