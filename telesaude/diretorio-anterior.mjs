/* Laboratório Telessaúde PromoVie: especialidade -> profissionais reais -> perfil -> widget.
   Integração original intocada: nunca cria sessão, não altera iframe, não grava mensagens.
   Esta versão só roda em /telesaude/atendimento-anterior/ após login opt-in autorizado. */
const ORDER=[
 {id:"clinico",name:"Clínico geral",description:"Orientação médica online.",mode:"Atendimento em até 10 minutos",pattern:/clinico|medicin(a|e) general|general (medic|pract|doctor)|primary care|family medic/,icon:"stethoscope"},
 {id:"psicologia",name:"Psicologia",description:"Escuta e saúde mental.",mode:"Com agendamento",pattern:/psicolog|psycholog|psicoterap|mental health/,icon:"brain"},
 {id:"nutricao",name:"Nutrição",description:"Alimentação e qualidade de vida.",mode:"Com agendamento",pattern:/nutric|nutrit|dietetic|dietitian/,icon:"apple"},
 {id:"fisico",name:"Treinamento físico",description:"Movimento e bem-estar.",mode:"Com agendamento",pattern:/trein|entren|physical train|fitness|educa(cao|dor) fisic|personal train|preparac(ao|ion) fisic/,icon:"dumbbell"},
 {id:"pediatria",name:"Pediatria",description:"Cuidado com as crianças.",mode:"Consulte disponibilidade",pattern:/pediatr|paediatr/,icon:"baby"},
 {id:"dermatologia",name:"Dermatologia",description:"Cuidados com a pele.",mode:"Com agendamento",pattern:/dermat/,icon:"droplet"},
 {id:"ginecologia",name:"Ginecologia",description:"Saúde feminina.",mode:"Consulte disponibilidade",pattern:/ginecol|gynecol|gynaecol/,icon:"heart"},
 {id:"veterinaria",name:"Veterinária",description:"Cuidado com seu pet.",mode:"Modalidade a confirmar",pattern:/veterinar|veterinary/,icon:"paw"}
];
const EXTRA={id:"outros",name:"Outras especialidades",description:"Outros profissionais disponíveis.",mode:"Ver disponibilidade",icon:"users"};
const SYMBOLS={
 stethoscope:'<path d="M6 3v5a6 6 0 0 0 12 0V3M4 3h4M16 3h4M12 14v2a4 4 0 0 0 8 0v-2"/><circle cx="20" cy="12" r="2"/>',
 brain:'<path d="M12 18V5a3 3 0 0 0-5.4-1.8A4 4 0 0 0 3 9a4 4 0 0 0 1 7 4 4 0 0 0 7 3M12 18V5a3 3 0 0 1 5.4-1.8A4 4 0 0 1 21 9a4 4 0 0 1-1 7 4 4 0 0 1-7 3"/><path d="M7 9c2 0 3 1 3 3M17 9c-2 0-3 1-3 3"/>',
 apple:'<path d="M12 7c-4-4-10 0-9 6 1 6 5 9 9 6 4 3 8 0 9-6 1-6-5-10-9-6Z"/><path d="M12 8c0-4 2-6 5-6M12 7c-2-3-4-3-6-3"/>',
 dumbbell:'<path d="M2 9v6M5 7v10M8 9v6M8 12h8M16 9v6M19 7v10M22 9v6"/>',
 baby:'<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14c2 3 5 3 7 0M12 3c0 3-2 4-4 4"/>',
 droplet:'<path d="M12 22c5 0 8-3 8-8 0-4-8-12-8-12S4 10 4 14c0 5 3 8 8 8Z"/><path d="M8 15c.5 2 2 3 4 3"/>',
 heart:'<path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 8-1 4 4 0 0 1 8 1Z"/><path d="M8 11h2l1-2 2 4 1-2h2"/>',
 paw:'<circle cx="7" cy="6" r="1.3"/><circle cx="12" cy="4.5" r="1.3"/><circle cx="17" cy="6" r="1.3"/><circle cx="20" cy="10" r="1.3"/><path d="M12 12c-2.5 0-3.4 3.5-5.7 4.5-1.5.8-1 4.1.9 4.1 2.2 0 3-1 4.8-1s2.6 1 4.8 1c1.9 0 2.4-3.3.9-4.1C15.4 15.5 14.5 12 12 12Z"/>',
 users:'<path d="M16 18a5 5 0 0 0-8 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM18 7a3 3 0 0 1 0 6M19 17a4 4 0 0 1 2 3M6 7a3 3 0 0 0 0 6M5 17a4 4 0 0 0-2 3"/>'
};
const ENDPOINT="https://backend.promovie.tv.br/api/promovie/directory/v1/catalog";
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
 .toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
const category=p=>{
 const label=norm(p.title);
 for(const item of ORDER)if(item.pattern.test(label))return item.id;
 return EXTRA.id;
};
const allowed=p=>p&&/^[A-Za-z0-9_-]{1,128}$/.test(p.id||"")&&
 typeof p.name==="string"&&p.name.trim().length>=2&&p.name.length<=90&&
 typeof p.title==="string"&&p.title.length<=90;
const icon=type=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
 (SYMBOLS[type]||SYMBOLS.users)+"</svg>";

export async function initDirectory(widget,grant,accessToken){
 const el=id=>document.getElementById(id);
 const button=el("directory-open"),dialog=el("directory-dialog"),query=el("directory-query");
 const results=el("directory-results"),message=el("directory-feedback");
 const close=el("directory-close"),alt=el("directory-alternative");
 const diagnostics=el("directory-diagnostics"),copy=el("directory-copy-status");
 const back=el("directory-back"),title=el("directory-title"),subtitle=el("directory-subtitle");
 const searchWrap=el("directory-search-wrap"),showWidget=el("directory-show-widget");
 if(!button||!dialog||!query||!results||!message||!close||!alt||!diagnostics||
    !copy||!back||!title||!subtitle||!searchWrap||!showWidget)return false;
 let catalog=[],loaded=false,state="iniciando",selectedCategory=null,selectedPerson=null;
 let stage="specialties",lastPerson=null,lastAttempt=null,busy=false;
 const tell=(status,text)=>{state=status;message.textContent=text;diagnostics.textContent="Diagnóstico: "+status;};
 const clearMessage=()=>{message.textContent="";};
 const elem=(tag,cls,content)=>{
   const node=document.createElement(tag);
   if(cls)node.className=cls;
   if(content!==undefined)node.textContent=content;
   return node;
 };
 const getArea=id=>ORDER.find(x=>x.id===id)||(id===EXTRA.id?EXTRA:null);
 const peopleFor=id=>catalog.filter(p=>p.category===id)
    .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
 const focusTitle=()=>{try{title.focus({preventScroll:true});}catch{}};
 const resetScroll=()=>{try{dialog.scrollTop=0;}catch{}};
 const showModal=()=>{
   if(!dialog.open&&typeof dialog.showModal==="function")dialog.showModal();
   render();focusTitle();
 };
 const closeModal=()=>{if(dialog.open)dialog.close();};
 button.hidden=false;
 button.setAttribute("aria-label","Abrir especialidades e profissionais");
 button.addEventListener("click",()=>{stage="specialties";selectedCategory=null;selectedPerson=null;clearMessage();showModal();});
 close.addEventListener("click",closeModal);
 showWidget.addEventListener("click",closeModal);
 dialog.addEventListener("click",event=>{if(event.target===dialog)closeModal();});
 back.addEventListener("click",()=>{
   if(busy)return;
   if(stage==="profile")stage="people";else{stage="specialties";selectedCategory=null;}
   selectedPerson=null;alt.hidden=true;clearMessage();render();resetScroll();focusTitle();
 });
 copy.addEventListener("click",()=>{
   const text="Telessaúde PromoVie | Teste de profissionais\n"+
     "Estado: "+state+"\nProfissionais encontrados: "+catalog.length+
     "\nÚltimo método: "+(lastAttempt||"nenhum")+
     "\nSem CPF, senha, token ou dados de consulta.";
   navigator.clipboard?.writeText(text).then(()=>{
     diagnostics.textContent="Diagnóstico copiado, sem dados de acesso.";
   }).catch(()=>{diagnostics.textContent="Não foi possível copiar automaticamente.";});
 });
 function render(){
   results.replaceChildren();alt.hidden=true;
   back.hidden=stage==="specialties";
   searchWrap.hidden=stage!=="people";
   if(stage==="specialties"){
     title.textContent="Como podemos cuidar de você?";
     subtitle.textContent="Escolha uma especialidade para conhecer os profissionais.";
     showWidget.textContent="Usar a lista original da Médiquo";
     const wrap=elem("div","directory-specialty-grid");
     const areas=[...ORDER,...(catalog.some(p=>p.category===EXTRA.id)?[EXTRA]:[])];
     for(const area of areas){
       const count=peopleFor(area.id).length;
       const card=elem("button","directory-specialty-card directory-tone-"+area.id);
       card.type="button";card.dataset.category=area.id;
       card.setAttribute("aria-label",area.name+". "+area.mode+". "+count+" profissionais encontrados. Ver profissionais.");
       const visual=elem("span","directory-specialty-icon");visual.innerHTML=icon(area.icon);
       const heading=elem("strong","directory-specialty-name",area.name);
       const desc=elem("span","directory-specialty-desc",area.description);
       const footer=elem("span","directory-specialty-footer");
       const mode=elem("span","directory-specialty-mode",area.mode);
       const arrow=elem("span","directory-specialty-arrow","›");arrow.setAttribute("aria-hidden","true");
       footer.append(mode,arrow);card.append(visual,heading,desc,footer);
       const counter=elem("span","directory-specialty-count",
         !loaded?"Consultando profissionais":count?count+" profissional"+(count>1?"is":""):"Nenhum profissional retornado");
       card.append(counter);wrap.append(card);
     }
     wrap.addEventListener("click",e=>{
       const card=e.target.closest("button[data-category]");
       if(!card)return;
       selectedCategory=card.dataset.category;selectedPerson=null;stage="people";
       query.value="";clearMessage();render();resetScroll();focusTitle();
     });
     results.append(wrap);
     const hint=elem("p","directory-stage-hint",
       "Os profissionais e os horários são informados pela Médiquo. Se não houver nomes, use a lista original ou consulte o suporte.");
     results.append(hint);
   }else if(stage==="people"){
     const area=getArea(selectedCategory);
     if(!area){stage="specialties";render();return;}
     title.textContent=area.name;
     subtitle.textContent="Selecione um profissional desta especialidade.";
     showWidget.textContent="Abrir a lista original da Médiquo";
     const list=elem("div","directory-people-list");
     const q=norm(query.value);
     const people=peopleFor(area.id).filter(p=>norm(p.name+" "+p.title).includes(q));
     for(const person of people){
       const item=elem("button","directory-person");
       item.type="button";item.dataset.id=person.id;
       const avatar=elem("span","directory-avatar",person.name.trim().charAt(0).toLocaleUpperCase("pt-BR"));
       const content=elem("span","directory-person-content");
       content.append(elem("strong","",person.name));
       content.append(elem("small","",person.title||area.name));
       const arrow=elem("span","directory-chevron");
       arrow.setAttribute("aria-hidden","true");item.append(avatar,content,arrow);
       list.append(item);
     }
     list.addEventListener("click",e=>{
       const item=e.target.closest("button.directory-person");
       if(!item||busy)return;
       const person=catalog.find(p=>p.id===item.dataset.id&&p.category===selectedCategory);
       if(!person)return;
       selectedPerson=person;stage="profile";clearMessage();render();resetScroll();focusTitle();
     });
     results.append(list);
     if(!people.length){
       results.append(elem("p","directory-empty",
         catalog.length===0
           ?"Não há profissionais reais retornados nesta sessão. A lista oficial permanece disponível."
           :q?"Nenhum profissional corresponde à busca.":"Nenhum profissional desta especialidade foi retornado para o seu acesso."));
     }
     results.append(elem("p","directory-stage-hint",
       "Somente nomes autorizados para sua conta. Disponibilidade e agendamento são confirmados no aplicativo oficial."));
   }else if(stage==="profile"){
     const person=selectedPerson,area=getArea(selectedCategory);
     if(!person||!area){stage="specialties";render();return;}
     title.textContent="Conheça o profissional";
     subtitle.textContent="Confira antes de abrir a conversa.";
     showWidget.textContent="Consultar lista original";
     const article=elem("article","directory-profile");
     const head=elem("div","directory-profile-head");
     const avatar=elem("span","directory-profile-avatar",person.name.charAt(0).toLocaleUpperCase("pt-BR"));
     const names=elem("div","directory-profile-names");
     names.append(elem("h3","",person.name),elem("p","",person.title||area.name));
     head.append(avatar,names);article.append(head);
     article.append(elem("span","directory-profile-mode",area.mode));
     article.append(elem("p","directory-profile-desc",area.description));
     article.append(elem("p","directory-profile-note",
       "O fornecedor não disponibilizou uma fotografia ou biografia nesta consulta. Os dados acima correspondem ao cadastro real retornado para sua sessão."));
     const start=elem("button","directory-profile-start","Abrir conversa na Médiquo");
     start.type="button";start.addEventListener("click",()=>attempt(person,"navigate"));
     article.append(start);
     results.append(article);
   }
 }
 query.addEventListener("input",()=>{if(stage==="people")render();});
 function awaitVendorSignal(hash,timeoutMs=6500){
   return new Promise(resolve=>{
     let done=false;
     const root=document.getElementById("MediquoContainer");
     const frame=root?.tagName==="IFRAME"?root:root?.querySelector("iframe");
     function finish(ok){
       if(done)return;
       done=true;window.removeEventListener("message",onMessage);clearTimeout(timer);resolve(ok);
     }
     function onMessage(event){
       if(event.origin!=="https://widget.mediquo.com"||
          event.source!==frame?.contentWindow)return;
       const data=event.data;
       if(data?.command!=="message")return;
       if(data.payload?.professional?.hash===hash)finish(true);
     }
     const timer=setTimeout(()=>finish(false),timeoutMs);
     window.addEventListener("message",onMessage);
   });
 }
 async function attempt(person,method){
   if(!person||busy||!catalog.some(p=>p.id===person.id))return;
   busy=true;lastPerson=person;lastAttempt=method;alt.hidden=true;
   const start=results.querySelector(".directory-profile-start");
   if(start)start.disabled=true;
   tell("abrindo-"+method,"Abrindo o profissional na Médiquo e verificando a resposta...");
   try{
     if(method==="navigate"&&typeof widget.navigate!=="function")throw Error("navigate indisponível");
     if(method==="open_room"&&typeof widget.open_room!=="function")throw Error("open_room indisponível");
     const confirmation=awaitVendorSignal(person.id);
     if(method==="navigate")widget.navigate("/professionals/"+encodeURIComponent(person.id)+"/room");
     else widget.open_room(person.id);
     if(await confirmation){
       tell("conversa-confirmada-"+method,"A Médiquo sinalizou a abertura da conversa selecionada.");
       closeModal();
     }else{
       tell("sem-confirmacao-"+method,
         "Não recebemos confirmação da conversa. Confira a Médiquo ou tente a abertura alternativa.");
       alt.hidden=method!=="navigate"||typeof widget.open_room!=="function";
     }
   }catch{
     tell("metodo-indisponivel-"+method,
       "Esta forma de abrir o profissional não está disponível nesta versão da Médiquo.");
     alt.hidden=method!=="navigate"||typeof widget.open_room!=="function";
   }finally{
     busy=false;
     const b=results.querySelector(".directory-profile-start");if(b)b.disabled=false;
   }
 }
 alt.addEventListener("click",()=>{if(lastPerson&&!busy)attempt(lastPerson,"open_room");});
 tell("carregando","Consultando os profissionais reais autorizados para seu acesso...");
 render();showModal();
 if(!/^[A-Za-z0-9_-]{43}$/.test(grant||"")||
    typeof accessToken!=="string"||accessToken.length<24){
   tell("sessao-sem-permissao",
     "A sessão não liberou a consulta experimental de profissionais. A lista original continua disponível.");
   loaded=true;render();return false;
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
     loaded=true;render();
     tell("catalogo-http-"+response.status,
       "Não foi possível consultar os profissionais reais. Resposta: "+response.status+".");
     return false;
   }
   const data=await response.json();
   if(!Array.isArray(data?.items))throw Error("Formato inesperado");
   const seen=new Set();
   catalog=data.items.filter(p=>{
     if(!allowed(p)||seen.has(p.id))return false;seen.add(p.id);return true;
   }).slice(0,160).map(p=>({
     id:p.id,name:p.name.trim(),title:p.title.trim(),category:category(p)
   }));
   loaded=true;render();
   if(!catalog.length)tell("catalogo-vazio",
     "O serviço não retornou profissionais disponíveis para seu acesso. Nenhum nome foi inventado.");
   else tell("catalogo-real-"+catalog.length,
     "Encontrados "+catalog.length+" profissionais reais. Escolha uma especialidade para continuar.");
   return catalog.length>0;
 }catch{
   loaded=true;render();
   tell("erro-consulta",
     "A consulta experimental não respondeu. A lista oficial da Médiquo permanece disponível.");
   return false;
 }
}
