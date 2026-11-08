/* PromoVie | diretório por especialidade.
   Camada de apresentação do experimento 20261107. Nunca modifica o SDK, 
   não reproduz tokens nem envia mensagens clínicas. */
const SERVICES=[
 {key:"Clínico geral",pattern:/clinico|medic[oa] (?:geral|generalista|de plantao|da familia)|medicina (?:geral|de familia)|pronto.?atendimento|plantao medico|general (medic|pract|doctor)|primary care|family medic/,
  desc:"Orientação médica on-line",kind:"24 horas · até 10 minutos",detail:"Atendimento 24 horas, todos os dias, sem agendamento."},
 {key:"Psicologia",pattern:/psicolog|psycholog|psicoterap|mental health/,
  desc:"Escuta e saúde mental",kind:"Agendamento",detail:"Atendimento mediante agendamento de horário."},
 {key:"Nutrição",pattern:/nutric|nutrit|dietetic|dietitian/,
  desc:"Alimentação e bem-estar",kind:"Agendamento",detail:"Atendimento mediante agendamento de horário."},
 {key:"Treinamento físico",pattern:/trein|entren|physical train|fitness|educa(cao|dor) fisic|personal train|preparac(ao|ion) fisic/,
  desc:"Movimento e condicionamento",kind:"Agendamento",detail:"Atendimento mediante agendamento de horário."},
 {key:"Pediatria",pattern:/pediatr|paediatr/,
  desc:"Atenção à saúde infantil",kind:"Até 10 min · em horário disponível",detail:"Atendimento em horários específicos, conforme disponibilidade."},
 {key:"Dermatologia",pattern:/dermat/,
  desc:"Cuidados com a pele",kind:"Agendamento",detail:"Verifique os horários de agendamento disponíveis."},
 {key:"Ginecologia",pattern:/ginecol|gynecol|gynaecol/,
  desc:"Saúde e cuidado da mulher",kind:"Até 10 min · em horário disponível",detail:"Atendimento em horários específicos, conforme disponibilidade."},
 {key:"Veterinária",pattern:/veterinar|veterinary/,
  desc:"Orientação de saúde para pets",kind:"Consultar disponibilidade",detail:"Consulte o atendimento e os horários disponíveis."}
];
const EXTRA={key:"Outras especialidades",desc:"Outros serviços autorizados",kind:"Consultar disponibilidade",detail:"Veja os profissionais disponíveis para este acesso."};
const ENDPOINT="https://backend.promovie.tv.br/api/promovie/directory/v1/catalog";
const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
const classify=p=>{
 const label=norm(p.title);
 for(const s of SERVICES)if(s.pattern.test(label))return s.key;
 return EXTRA.key;
};
const valid=p=>p&&/^[A-Za-z0-9_-]{1,128}$/.test(p.id||"")&&
 typeof p.name==="string"&&p.name.trim().length>=2&&p.name.length<=90&&
 typeof p.title==="string"&&p.title.length<=90;
const node=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
};
function profileAvatar(person,size){
 const element=node("div","hub-avatar "+(size||""),person.name.split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join("").toUpperCase());
 // Fotografias só são exibidas se o backend autorizado disponibilizar uma URL HTTPS do fornecedor.
 if(typeof person.avatar==="string"){
   try{
     const url=new URL(person.avatar);
     if(url.protocol==="https:"&&(url.hostname==="mediquo.com"||url.hostname.endsWith(".mediquo.com")||url.hostname==="mediquo.com.br"||url.hostname.endsWith(".mediquo.com.br"))){
       const img=node("img");img.src=url.href;img.alt="";img.loading="lazy";img.decoding="async";
       img.onerror=()=>img.remove();
       element.replaceChildren(img);
     }
   }catch{}
 }
 return element;
}
export function initSpecialtyDirectory(widget,grant,accessToken){
 const el=id=>document.getElementById(id), dialog=el("directory-dialog"),trigger=el("directory-open");
 if(!dialog||!trigger)return false;
 dialog.classList.add("hub-dialog");
 dialog.innerHTML=[
 '<div class="hub-head"><div><small class="hub-eyebrow">TELESAÚDE PROMOVIE</small>',
 '<h2 id="directory-title">Como podemos cuidar de você?</h2>',
 '<p id="hub-subtitle">Selecione uma especialidade para conhecer os profissionais.</p></div>',
 '<a class="hub-exit" href="/telesaude/?teste=20261107-especialidades" aria-label="Sair do atendimento">Sair</a></div>',
 '<div id="hub-nav" class="hub-nav" hidden><button id="hub-back" type="button">← Especialidades</button><span id="hub-step"></span></div>',
 '<section id="hub-categories" class="hub-pane" aria-label="Selecionar especialidade">',
 '<div id="hub-category-grid" class="hub-grid"></div><p id="hub-note" class="hub-note"></p></section>',
 '<section id="hub-professionals" class="hub-pane" aria-label="Escolher profissional" hidden>',
 '<div class="hub-section-title"><h3 id="hub-service-title"></h3><p id="hub-service-lead"></p></div>',
 '<label class="hub-search"><span aria-hidden="true">⌕</span><input id="hub-query" type="search" autocomplete="off" placeholder="Buscar pelo nome" aria-label="Pesquisar profissional"></label>',
 '<div id="hub-list" class="hub-list"></div></section>',
 '<section id="hub-profile" class="hub-pane" aria-label="Prévia do profissional" hidden>',
 '<div id="hub-profile-body"></div><div class="hub-profile-actions">',
 '<button id="hub-open" class="hub-open" type="button">Entrar no atendimento</button>',
 '<button id="hub-other" class="hub-secondary" type="button">Ver outros profissionais</button>',
 '</div></section>',
 '<p id="hub-feedback" class="hub-feedback" role="status" aria-live="polite"></p>',
 '<div class="hub-footer"><button type="button" id="hub-native">Chat Médico</button></div>'
 ].join("");
 const nav=el("hub-nav"),back=el("hub-back"),step=el("hub-step");
 const categories=el("hub-categories"),grid=el("hub-category-grid"),note=el("hub-note");
 const professionals=el("hub-professionals"),serviceTitle=el("hub-service-title"),serviceLead=el("hub-service-lead");
 const list=el("hub-list"),query=el("hub-query");
 const profile=el("hub-profile"),profileBody=el("hub-profile-body"),open=el("hub-open");
 const feedback=el("hub-feedback"),native=el("hub-native");
 const headTitle=el("directory-title"),headSubtitle=el("hub-subtitle");
 const serviceHead=serviceTitle.parentElement, searchField=query.closest(".hub-search");
 let catalog=[],chosenService=null,chosenPerson=null,loaded=false,busy=false;
 const providerService=key=>SERVICES.find(s=>s.key===key)||EXTRA;
 const say=message=>{feedback.textContent=message||"";};
 function showPane(pane){
   categories.hidden=pane!=="categories";professionals.hidden=pane!=="professionals";profile.hidden=pane!=="profile";
   nav.hidden=pane==="categories";
   const clinical=pane==="professionals"&&chosenService==="Clínico geral";
   headTitle.textContent=clinical?"Plantão com médico clínico geral adulto e infantil":"Como podemos cuidar de você?";
   headSubtitle.textContent=clinical?
     "Atendimento com médicos plantonistas, sem agendamento.":
     "Selecione uma especialidade para conhecer os profissionais.";
   step.textContent=pane==="profile"?"Conheça o profissional":(chosenService||"");
   back.textContent=pane==="profile"?"← Voltar aos profissionais":"← Voltar às especialidades";
   dialog.scrollTop=0;
 }
 function renderCategories(){
   grid.replaceChildren();
   const keys=SERVICES.map(s=>s.key);
   if(catalog.some(p=>p.category===EXTRA.key))keys.push(EXTRA.key);
   for(const key of keys){
     const info=providerService(key),count=catalog.filter(p=>p.category===key).length;
     const card=node("button","hub-category");card.type="button";card.dataset.key=key;
     const mark=node("span","hub-category-mark");mark.setAttribute("aria-hidden","true");mark.textContent=String(keys.indexOf(key)+1).padStart(2,"0");
     const heading=node("strong",null,key),desc=node("small",null,info.desc);
     const meta=node("span","hub-kind",info.kind);
     const arrow=node("span","hub-arrow","›");arrow.setAttribute("aria-hidden","true");
     card.append(mark,heading,desc,meta,arrow);
     if(loaded){
       const quantity=node("span","hub-count",count?count+" "+(count===1?"profissional":"profissionais"):(key==="Clínico geral"?"Acesso pelo Chat Médico 24h":"Profissionais não listados"));
       card.append(quantity);
     }
     grid.append(card);
   }
   note.textContent=loaded?
     "As modalidades são informativas e podem variar conforme o seu plano e a disponibilidade do profissional.":
     "Consultando os profissionais autorizados para seu acesso...";
 }
 function showGroup(key){
   chosenService=key;chosenPerson=null;query.value="";
   const info=providerService(key);
   serviceTitle.textContent=key;serviceLead.textContent=info.detail;
   renderPeople();showPane("professionals");
 }
 function renderPeople(){
   list.replaceChildren();
   const filtered=catalog.filter(p=>p.category===chosenService&&norm(p.name).includes(norm(query.value)));
   if(!loaded){
     list.append(node("p","hub-empty","Carregando os profissionais disponíveis..."));return;
   }
   const clinicalFallback=chosenService==="Clínico geral"&&!catalog.some(p=>p.category==="Clínico geral");
   // No plantão clínico, a lista nativa é o caminho correto quando os nomes
   // individuais não fazem parte do catálogo. Evita busca vazia e erro enganoso.
   searchField.hidden=clinicalFallback;
   serviceHead.hidden=clinicalFallback;
   if(clinicalFallback){
     const box=node("div","hub-empty hub-clinical-fallback");
     const legend=node("p","hub-online-legend");
     const onlineDot=node("span","hub-online-dot");
     onlineDot.setAttribute("aria-hidden","true");
     legend.append(onlineDot,
       document.createTextNode("A bolinha verde identifica os profissionais que estão on-line."));
     box.append(node("strong","hub-fallback-title","Para consultar um clínico geral em até 10 minutos, acesse o Chat Médico e entre em contato com o clínico geral plantonista."),legend);
     list.append(box);
     return;
   }
   if(!filtered.length){
     list.append(node("p","hub-empty",!loaded?
       "Carregando os profissionais disponíveis...":
       query.value?"Nenhum profissional corresponde a esta pesquisa.":
       "Nenhum profissional foi listado nesta especialidade para o seu acesso."));
     return;
   }
   filtered.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
   for(const p of filtered){
     const item=node("button","hub-person");item.type="button";item.dataset.id=p.id;
     const copy=node("span","hub-person-copy");
     copy.append(node("strong",null,p.name),node("small",null,p.title||chosenService));
     const arrow=node("span","hub-person-arrow","Ver perfil ›");
     item.append(profileAvatar(p,"small"),copy,arrow);
     list.append(item);
   }
 }
 function showProfile(p){
   chosenPerson=p;profileBody.replaceChildren();
   const info=providerService(p.category);
   const head=node("div","hub-profile-head");
   const copy=node("div","hub-profile-copy");
   copy.append(node("small","hub-profile-eyebrow","Conheça o profissional"),
       node("h3",null,p.name),node("p",null,p.title||p.category),
       node("span","hub-profile-kind",info.kind));
   head.append(profileAvatar(p,"large"),copy);
   const intro=node("p","hub-profile-description",
       p.description||("Profissional de "+p.category.toLocaleLowerCase("pt-BR")+". Conheça o atendimento e as orientações disponíveis."));
   profileBody.append(head,intro,node("p","hub-profile-detail",info.detail));
   showPane("profile");
   open.focus({preventScroll:true});
 }
 function reopen(){renderCategories();showPane("categories");say("");if(!dialog.open)dialog.showModal();}
 trigger.hidden=false;trigger.addEventListener("click",reopen);
 grid.addEventListener("click",event=>{
   const card=event.target.closest("button.hub-category");if(card)showGroup(card.dataset.key);
 });
 list.addEventListener("click",event=>{
   const item=event.target.closest("button.hub-person");if(!item)return;
   const p=catalog.find(person=>person.id===item.dataset.id&&person.category===chosenService);
   if(p)showProfile(p);
 });
 query.addEventListener("input",renderPeople);
 back.addEventListener("click",()=>{if(!profile.hidden){showPane("professionals");}
   else {chosenService=null;showPane("categories");}});
 el("hub-other").addEventListener("click",()=>showPane("professionals"));
 dialog.addEventListener("cancel",e=>{
   e.preventDefault(); // não revelar a lista nativa antes de uma escolha explícita
   if(!profile.hidden)showPane("professionals");
   else if(!professionals.hidden)showPane("categories");
 });
 function openNative(){
   // Mantém a sessão em funcionamento. open_list() é caixa de mensagens,
   // não um seletor de profissionais. A interface nativa já foi inicializada.
   if(dialog.open)dialog.close();
   try{if(typeof widget.open==="function")widget.open();}catch{}
 }
 native.addEventListener("click",openNative);
 open.addEventListener("click",()=>{
   if(!chosenPerson||busy)return;
   busy=true;open.disabled=true;say("Abrindo o atendimento de "+chosenPerson.name+"...");
   try{
     // A rota abaixo foi COPIADA do teste de 7/11 que o usuário confirmou funcionar.
     // Não substituí-la silenciosamente pelo seletor posterior.
     const route="/professionals/"+encodeURIComponent(chosenPerson.id)+"/room";
     let result;
     if(typeof widget.navigate==="function")result=widget.navigate(route);
     else if(typeof widget.open_room==="function")result=widget.open_room(chosenPerson.id);
     else throw new Error("Nenhum método individual disponível");
     // O widget controla o chat; não esperaremos evento interno não documentado
     // para fechar a apresentação nem alegaremos consulta confirmada.
     Promise.resolve(result).catch(()=>{
       say("Não foi possível confirmar a abertura. Você pode usar Chat Médico.");
     });
     dialog.close();
   }catch{
     say("Não foi possível abrir este profissional. Tente o Chat Médico.");
   }finally{busy=false;open.disabled=false;}
 });
 renderCategories();reopen();
 if(!/^[A-Za-z0-9_-]{43}$/.test(grant||"")||typeof accessToken!=="string"||accessToken.length<24){
   loaded=true;renderCategories();
   note.textContent="A sessão não liberou o catálogo de profissionais. Use Chat Médico ou volte ao acesso.";
   return false;
 }
 // Fetch no backend já existente. Nenhum endpoint novo, credencial ou regra de elegibilidade.
 (async()=>{
   try{
     const controller=new AbortController();
     const timer=setTimeout(()=>controller.abort(),11000);
     let response;
     try{
       response=await fetch(ENDPOINT,{
         method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+grant},
         body:JSON.stringify({sdk_access_token:accessToken}),
         cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",signal:controller.signal
       });
     }finally{clearTimeout(timer);}
     if(!response.ok)throw new Error("Código "+response.status);
     const data=await response.json();
     if(!Array.isArray(data?.items))throw new Error("Catálogo não disponível");
     const ids=new Set();
     catalog=data.items.filter(p=>{
       if(!valid(p)||ids.has(p.id))return false;ids.add(p.id);return true;
     }).slice(0,160).map(p=>({
       id:p.id,name:p.name.trim(),title:p.title.trim(),
       category:classify(p),
       description:typeof p.description==="string"?p.description.trim().slice(0,500):"",
       avatar:typeof p.avatar==="string"?p.avatar:""
     }));
     loaded=true;renderCategories();
     if(chosenService)renderPeople();
     if(!catalog.length)note.textContent="Os profissionais ainda não foram carregados neste painel. Use Chat Médico para acessar o atendimento.";
   }catch{
     loaded=true;renderCategories();
     note.textContent="Não foi possível consultar o catálogo. Você pode continuar pelo Chat Médico.";
     if(chosenService)renderPeople();
   }
 })();
 return true;
}
