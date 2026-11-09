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
 {key:"Pet (cães e gatos)",pattern:/veterinar|veterinary/,
  desc:"Orientação de saúde para pets",kind:"Consultar disponibilidade",detail:"Consulte o atendimento e os horários disponíveis."}
];

/* Imagens originais da seção Telessaúde do site oficial PromoVie.
   Uso ilustrativo: não representam necessariamente médicos plantonistas. */
const CATEGORY_IMAGES=Object.freeze({
 "Clínico geral":"https://static.wixstatic.com/media/279d86_00b6385598f04689b78e7cee1297814d~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_00b6385598f04689b78e7cee1297814d~mv2.jpg",
 "Psicologia":"https://static.wixstatic.com/media/279d86_9f18304381da41df9cd6b4de3296510a~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_9f18304381da41df9cd6b4de3296510a~mv2.jpg",
 "Nutrição":"https://static.wixstatic.com/media/279d86_ed9bfd930b8a40bcb7a2ba19653a8848~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_ed9bfd930b8a40bcb7a2ba19653a8848~mv2.jpg",
 "Treinamento físico":"https://static.wixstatic.com/media/279d86_4167b1bf6d6241abbd0c2284024de025~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_4167b1bf6d6241abbd0c2284024de025~mv2.jpg",
 "Pediatria":"https://static.wixstatic.com/media/279d86_4165a6f5bdea484ca54cbce4ac2d42ba~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_4165a6f5bdea484ca54cbce4ac2d42ba~mv2.jpg",
 "Dermatologia":"https://static.wixstatic.com/media/279d86_f20e162c4a874ff8b7f77c37f2f27e07~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_f20e162c4a874ff8b7f77c37f2f27e07~mv2.jpg",
 "Ginecologia":"https://static.wixstatic.com/media/279d86_89eb9cace0394a9783156d5c9d3e05c1~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_89eb9cace0394a9783156d5c9d3e05c1~mv2.jpg",
 "Pet (cães e gatos)":"https://static.wixstatic.com/media/279d86_332637580c72430295e77ea81c0d6e2a~mv2.jpg/v1/fill/w_480,h_288,al_c,q_72,usm_0.66_1.00_0.01,enc_auto/279d86_332637580c72430295e77ea81c0d6e2a~mv2.jpg"
});
/* Apelidos e nomes profissionais aceitos na pesquisa unificada.
   O acesso a profissionais continua limitado ao catálogo autorizado. */
const CATEGORY_SEARCH=Object.freeze({
 "Clínico geral":["clinico","clinicos","medico","medicos","medicina geral","plantonista","plantao","adulto"],
 "Psicologia":["psico","psicologo","psicologos","psicologa","psicologas","psicoterapia","terapia","saude mental"],
 "Nutrição":["nutri","nutricionista","nutricionistas","alimentacao"],
 "Treinamento físico":["treinador","treinadora","educacao fisica","personal","atividade fisica","exercicios"],
 "Pediatria":["pediatra","pediatras","crianca","criancas","infantil"],
 "Dermatologia":["dermato","dermatologista","dermatologistas","pele"],
 "Ginecologia":["gineco","ginecologista","ginecologistas","saude da mulher"],
 "Pet (cães e gatos)":["pet","pets","veterinaria","veterinario","veterinarios","cao","caes","gato","gatos"]
});
const EXTRA={key:"Outras especialidades",desc:"Outros serviços autorizados",kind:"Consultar disponibilidade",detail:"Veja os profissionais disponíveis para este acesso."};
const ENDPOINT="https://backend.promovie.tv.br/api/promovie/directory/v1/catalog-profile";
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
 const initials=person.name.split(/\s+/).slice(0,2).map(w=>w.charAt(0)).join("").toUpperCase();
 const element=node("div","hub-avatar "+(size||""));
 const fallback=node("span","hub-avatar-initials",initials);
 element.append(fallback);
 // O próprio catálogo autorizado da Médiquo fornece a URL da fotografia.
 // A imagem entra somente após carregar: caso falhe, as iniciais continuam.
 if(typeof person.avatar==="string"&&person.avatar){
   try{
     const url=new URL(person.avatar);
     // O servidor da Médiquo já validou a URL pública da foto.
     // A imagem pode estar em uma CDN em vez de um subdomínio da Médiquo.
     const approved=url.protocol==="https:"&&!url.username&&!url.password;
     if(approved){
       const img=node("img");
       img.alt="Foto de "+person.name;
       img.loading="lazy";img.decoding="async";img.referrerPolicy="no-referrer";
       img.style.opacity="0";
       img.addEventListener("load",()=>{
         if(img.naturalWidth>0){
           element.classList.add("photo-ready");
           img.style.opacity="1";fallback.hidden=true;
         }
       },{once:true});
       // A imagem precisa estar no DOM para o carregamento lazy começar.
       // Se falhar, removemos só a imagem e preservamos as iniciais.
       img.addEventListener("error",()=>img.remove(),{once:true});
       element.append(img);
       img.src=url.href;
     }
   }catch{}
 }
 return element;
}
function publicProfileInfo(person){
 const wrap=node("div","pv-profile-data");
 if(person.collegiate_number){
   const row=node("div","pv-profile-row");
   row.append(node("b",null,"Registro profissional"),node("span",null,person.collegiate_number));
   wrap.append(row);
 }
 if(person.status==="online"||person.status==="offline"){
   const state=node("div","pv-profile-availability");
   const dot=node("span",person.status==="online"?"pv-profile-online-dot":"pv-profile-offline-dot");
   dot.setAttribute("aria-hidden","true");
   state.append(dot,document.createTextNode(person.status==="online"?
     "Profissional on-line":"Profissional não indicado como on-line"));
   wrap.append(state);
 }
 if(Array.isArray(person.languages)&&person.languages.length){
   const row=node("div","pv-profile-row");
   row.append(node("b",null,"Idiomas"),node("span",null,person.languages.join(", ")));
   wrap.append(row);
 }
 return wrap;
}
function publicProfileDescription(person){
 return person.description||
   "Não conseguimos carregar a descrição deste profissional no catálogo disponível. O perfil completo continua disponível no Chat Médico.";
}
export function initSpecialtyDirectory(widget,grant,accessToken){
 const el=id=>document.getElementById(id), dialog=el("directory-dialog"),trigger=el("directory-open");
 if(!dialog||!trigger)return false;
 dialog.classList.add("hub-dialog");
 dialog.innerHTML=[
 '<div class="hub-brand-strip" aria-label="Telessaúde PromoVie">',
 '<img src="/app/assets/coracao-promovie-com-logo.webp?v=transparente-1" width="47" height="47" alt="">',
 '<strong class="pv-brand-name">Telessaúde</strong></div>',
 '<div class="hub-head"><div>',
 '<h2 id="directory-title">Vamos te ajudar a cuidar de você.</h2>',
 '<p id="hub-subtitle">Selecione uma especialidade para conhecer os profissionais.</p></div>',
 '<div class="hub-head-tools">',
 '<a id="hub-professionals-link" class="hub-professionals-link" href="https://profissionais-telessaude.vercel.app/" target="_blank" rel="noopener noreferrer" aria-label="Conheça nossos profissionais (abre em nova aba)" title="Conheça nossos profissionais"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12h3.7l2.7-6.5L12 18.4l3.1-6.4h6.4"/></svg></a>',
 '<button id="hub-top-back" class="hub-exit" type="button" hidden>← Voltar às especialidades</button>',
 '</div></div>',
 '<section id="hub-categories" class="hub-pane" aria-label="Selecionar especialidade">',
 '<label class="hub-search hub-search-global"><span aria-hidden="true">⌕</span><input id="hub-global-query" type="search" autocomplete="off" placeholder="Buscar profissional ou especialidade" aria-label="Pesquisar profissionais e especialidades" aria-controls="hub-global-results"></label>',
 '<div id="hub-global-results" class="hub-list hub-global-results" hidden></div>',
 '<div id="hub-category-grid" class="hub-grid"></div><p id="hub-note" class="hub-note"></p></section>',
 '<section id="hub-professionals" class="hub-pane" aria-label="Escolher profissional" hidden>',
 '<div class="hub-section-title"><h3 id="hub-service-title"></h3><p id="hub-service-lead"></p></div>',
 '<label class="hub-search"><span aria-hidden="true">⌕</span><input id="hub-query" type="search" autocomplete="off" placeholder="Buscar pelo nome" aria-label="Pesquisar profissional"></label>',
 '<p class="hub-original-profile-help">Ao abrir o profissional no Chat Médico, toque no nome ou na foto para consultar seu perfil original. Use Voltar para retornar à conversa.</p>',
 '<div id="hub-list" class="hub-list"></div></section>',
 '<section id="hub-profile" class="hub-pane" aria-label="Prévia do profissional" hidden>',
 '<div id="hub-profile-body"></div><div class="hub-profile-actions">',
 '<button id="hub-open" class="hub-open" type="button">Entrar no atendimento</button>',
 '<button id="hub-other" class="hub-secondary" type="button">Ver outros profissionais</button>',
 '</div></section>',
 '<p id="hub-feedback" class="hub-feedback" role="status" aria-live="polite"></p>',
 '<nav class="hub-footer" aria-label="Navegação da Telessaúde"><div class="hub-shortcuts">',
 '<button type="button" id="hub-shortcut-appointments">Agendamentos e Suporte</button>',
 '<button type="button" id="hub-shortcut-space">Meu Espaço de Saúde</button>',
 '</div><button type="button" id="hub-native" class="hub-native-full">Chat Médico</button></nav>'
 ].join("");
 const topBack=el("hub-top-back");
 const categories=el("hub-categories"),grid=el("hub-category-grid"),note=el("hub-note");
 const globalQuery=el("hub-global-query"),globalResults=el("hub-global-results");
 const chatSearch=el("chat-search-name"),chatResults=el("chat-search-results"),chatShell=el("chat-search-shell");
 const professionals=el("hub-professionals"),serviceTitle=el("hub-service-title"),serviceLead=el("hub-service-lead");
 const list=el("hub-list"),query=el("hub-query");
 const profile=el("hub-profile"),profileBody=el("hub-profile-body"),open=el("hub-open");
 const feedback=el("hub-feedback"),native=el("hub-native");
 const appointmentDialog=el("appointments-dialog"),appointmentTrigger=el("appointments-trigger");
 const headTitle=el("directory-title"),headSubtitle=el("hub-subtitle");
 const serviceHead=serviceTitle.parentElement, searchField=query.closest(".hub-search");
 let catalog=[],chosenService=null,chosenPerson=null,loaded=false,busy=false,profileFromSearch=false;
 let appointmentReturn="specialties";
 const providerService=key=>SERVICES.find(s=>s.key===key)||EXTRA;
 const say=message=>{feedback.textContent=message||"";};
 function showPane(pane){
   categories.hidden=pane!=="categories";professionals.hidden=pane!=="professionals";profile.hidden=pane!=="profile";
   topBack.hidden=pane==="categories";
   const clinical=pane==="professionals"&&chosenService==="Clínico geral";
   headTitle.textContent=clinical?"Plantão com médico clínico geral adulto e infantil":"Vamos te ajudar a cuidar de você.";
   headSubtitle.textContent=clinical?
     "Atendimento com médicos plantonistas, sem agendamento.":
     "Selecione uma especialidade para conhecer os profissionais.";
   dialog.scrollTop=0;
 }
 function renderCategories(){
   grid.replaceChildren();
   // A grade contém somente especialidades, sem repetir Agendamentos do rodapé.
   const keys=SERVICES.map(s=>s.key);
   for(const [index,key] of keys.entries()){
     const info=providerService(key);
     const count=catalog.filter(p=>p.category===key).length;
     const card=node("button","hub-category hub-category-photo");card.type="button";card.dataset.key=key;
     const imageArea=node("span","hub-category-visual");
     const image=node("img","hub-category-image");
     image.src=CATEGORY_IMAGES[key];image.alt="";
     image.loading=index<4?"eager":"lazy";image.decoding="async";
     image.onerror=()=>{image.remove();imageArea.classList.add("hub-category-image-unavailable");};
     // A fotografia inteira é clicável. Não é preciso numerá-la ou
     // sobrepor uma seta; o texto do cartão continua intacto.
     imageArea.append(image);
     const body=node("span","hub-category-body");
     const heading=node("strong",null,key),desc=node("small",null,info.desc);
     if(key==="Pet (cães e gatos)"){
       heading.replaceChildren(document.createTextNode("Pet "),
         node("span","hub-pet-detail","(cães e gatos)"));
     }
     const meta=node("span","hub-kind",info.kind);
     body.append(heading,desc,meta);
     if(loaded){
       const withoutNames=key==="Clínico geral"?"Acesso pelo Chat Médico 24h":
         key==="Pediatria"?"Acesso pelo Chat Médico":"Profissionais não listados";
       const quantity=node("span","hub-count",count?count+" "+(count===1?"profissional":"profissionais"):withoutNames);
       body.append(quantity);
     }
     card.append(imageArea,body);
     grid.append(card);
   }
   note.textContent=loaded?
     "As modalidades são informativas e podem variar conforme o seu plano e a disponibilidade do profissional.":
     "Consultando os profissionais autorizados para seu acesso...";
   renderGlobalSearch();
 }
 function renderGlobalSearch(){
   const term=norm(globalQuery.value);
   grid.hidden=Boolean(term);
   note.hidden=Boolean(term);
   globalResults.hidden=!term;
   globalResults.replaceChildren();
   if(!term)return;

   // Termos como "psico", "psicólogo", "dermato" e variações com acento.
   const specialities=SERVICES.filter(info=>
     [info.key,info.desc,...(CATEGORY_SEARCH[info.key]||[])]
       .some(label=>norm(label).includes(term)));
   const bySpeciality=new Set(specialities.map(info=>info.key));
   if(specialities.length){
     globalResults.append(node("p","hub-search-group-title","Especialidades"));
     for(const info of specialities){
       const item=node("button","hub-search-category");
       item.type="button";item.dataset.speciality=info.key;
       const badge=node("span","hub-search-category-mark","✦");
       badge.setAttribute("aria-hidden","true");
       const copy=node("span","hub-person-copy");
       const qty=catalog.filter(p=>p.category===info.key).length;
       const detail=loaded?
         (qty?qty+" "+(qty===1?"profissional":"profissionais"):
          info.key==="Clínico geral"||info.key==="Pediatria"?
            "Acesso pelo Chat Médico":"Consultar atendimento"):
         info.desc;
       copy.append(node("strong",null,info.key),
         node("small",null,detail));
       item.append(badge,copy,node("span","hub-person-arrow","Ver profissionais ›"));
       globalResults.append(item);
     }
   }
   if(!loaded){
     globalResults.append(node("p","hub-search-info","Carregando profissionais..."));
     return;
   }
   // A busca por nome funciona sempre. Com três caracteres, uma busca
   // por especialidade também localiza profissionais vinculados a ela.
   const matches=catalog.filter(p=>
     norm(p.name).includes(term)||
     (term.length>=3&&(bySpeciality.has(p.category)||
       norm(p.title).includes(term)||norm(p.category).includes(term))))
     .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
   if(matches.length){
     globalResults.append(node("p","hub-search-group-title","Profissionais"));
     for(const p of matches.slice(0,12)){
       const item=node("button","hub-person");
       item.type="button";item.dataset.id=p.id;
       const copy=node("span","hub-person-copy");
       copy.append(node("strong",null,p.name),node("small",null,p.title||p.category));
       item.append(profileAvatar(p,"small"),copy,
         node("span","hub-person-arrow","Abrir no Chat Médico ›"));
       globalResults.append(item);
     }
     if(matches.length>12){
       globalResults.append(node("p","hub-search-info",
         "Exibindo 12 de "+matches.length+" profissionais. Selecione a especialidade para ver todos."));
     }
   }else if(!specialities.length){
     globalResults.append(node("p","hub-empty",
       "Nenhuma especialidade ou profissional corresponde a esta pesquisa."));
   }
 }
 function showGroup(key){
   chosenService=key;chosenPerson=null;query.value="";
   const info=providerService(key);
   serviceTitle.textContent=key;serviceLead.textContent=info.detail;
   renderPeople();showPane("professionals");
 }
 function renderPeople(){
   list.replaceChildren();
   // Busca dentro de uma especialidade apenas para Psicologia;
   // preserva a pesquisa geral e a busca opcional no Chat Médico.
   const searchInSpecialty=chosenService==="Psicologia";
   searchField.hidden=!searchInSpecialty;
   const filtered=catalog.filter(p=>p.category===chosenService&&
     (!searchInSpecialty||norm(p.name).includes(norm(query.value))));
   if(!loaded){
     list.append(node("p","hub-empty","Carregando os profissionais disponíveis..."));return;
   }
   const clinicalFallback=chosenService==="Clínico geral"&&!catalog.some(p=>p.category==="Clínico geral");
   // No plantão clínico, a lista nativa é o caminho correto quando os nomes
   // individuais não fazem parte do catálogo. Evita busca vazia e erro enganoso.
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
     const arrow=node("span","hub-person-arrow","Abrir no Chat Médico ›");
     item.append(profileAvatar(p,"small"),copy,arrow);
     list.append(item);
   }
 }
 async function openProfessional(p){
   if(!p||busy)return;
   busy=true;
   say("Abrindo o atendimento de "+p.name+"...");
   try{
     const route="/professionals/"+encodeURIComponent(p.id)+"/room";
     if(typeof widget.navigate==="function")await Promise.resolve(widget.navigate(route));
     else if(typeof widget.open_room==="function")await Promise.resolve(widget.open_room(p.id));
     else throw Error("Abertura individual indisponível neste Widget.");
     if(dialog.open)dialog.close();
     document.body.classList.remove("pv-navigation-mode");
     document.documentElement.classList.add("pv-chat-mode");
     chatShell?.removeAttribute("hidden");
     if(chatResults){chatResults.hidden=true;chatResults.replaceChildren();}
     if(chatSearch)chatSearch.value="";
     say("");
   }catch{
     if(!dialog.open)reopen();
     say("Não foi possível abrir este profissional. Tente novamente ou use Chat Médico.");
   }finally{busy=false;}
 }
 function showProfile(p,fromSearch=false){
   profileFromSearch=fromSearch;
   chosenPerson=p;profileBody.replaceChildren();
   const head=node("div","hub-profile-head");
   const copy=node("div","hub-profile-copy");
   copy.append(node("small","hub-profile-eyebrow","Perfil profissional"),
       node("h3",null,p.name),node("p",null,p.title||p.category));
   copy.append(publicProfileInfo(p));
   head.append(profileAvatar(p,"large"),copy);
   profileBody.append(head,node("h4","pv-profile-section-title","Sobre o profissional"),
     node("p","hub-profile-description",publicProfileDescription(p)));
   if(!p.avatar)profileBody.append(node("p","pv-profile-missing",
     "Fotografia não carregada neste catálogo. O perfil original da Médiquo pode exibi-la."));
   // A consulta é aberta somente depois da leitura do perfil e de novo clique.
   open.textContent="Acessar atendimento com "+p.name;
   showPane("profile");
   open.focus({preventScroll:true});
 }
 function reopen(){
   renderCategories();showPane("categories");say("");
   document.body.classList.add("pv-navigation-mode");
   document.documentElement.classList.remove("pv-chat-mode");
   document.getElementById("chat-search-shell")?.setAttribute("hidden","");
   if(!dialog.open)dialog.showModal();
 }
 function openAppointments(){
   if(dialog.open)dialog.close();
   appointmentReturn="specialties";
   document.body.classList.add("pv-navigation-mode");
   if(appointmentTrigger)appointmentTrigger.click();
 }
 function restoreAfterSpace(destination){
   const chat=destination==="chat";
   document.body.classList.toggle("pv-navigation-mode",!chat);
   document.documentElement.classList.toggle("pv-chat-mode",chat);
   if(chat){
     document.getElementById("chat-search-shell")?.removeAttribute("hidden");
   }else{
     document.getElementById("chat-search-shell")?.setAttribute("hidden","");
     // Retorna ao mesmo estado: grade, lista ou perfil que já estava aberto.
     if(!dialog.open)dialog.showModal();
   }
 }
 window.addEventListener("promovie:space-return",event=>{
   restoreAfterSpace(event.detail?.destination==="chat"?"chat":"specialties");
 });
 // Se o agendamento foi aberto de dentro dos registros, fechar o modal
 // deve devolver ao Meu Espaço, e não abrir Especialidades por cima.
 window.addEventListener("promovie:space-appointments",()=>{
   if(el("space-embedded")&&!el("space-embedded").hidden)
     appointmentReturn="space";
 });
 const spaceLink=document.querySelector(".space-entry");
 spaceLink?.addEventListener("click",()=>{
   const layer=el("space-embedded");
   if(layer)layer.dataset.returnTo=
     document.documentElement.classList.contains("pv-chat-mode")&&!dialog.open?
       "chat":"specialties";
 },{capture:true});
 function openMySpace(){
   const link=document.querySelector(".space-entry");
   const footer=document.querySelector(".space-footer");
   if(!link||!footer||footer.hidden){
     const target=appointmentDialog?.open?el("appointments-space-feedback"):feedback;
     if(target)target.textContent="Meu Espaço de Saúde não está disponível para este acesso.";
     return;
   }
   const origin=document.documentElement.classList.contains("pv-chat-mode")&&!dialog.open?
     "chat":"specialties";
   const embedded=el("space-embedded");
   if(embedded)embedded.dataset.returnTo=origin;
   if(dialog.open)dialog.close();
   if(appointmentDialog?.open){
     appointmentReturn="space";
     appointmentDialog.close();
   }
   document.body.classList.remove("pv-navigation-mode");
   // Reutiliza a sessão protegida já ativa, sem reinicializar o SDK.
   link.click();
   if(!embedded||embedded.hidden){
     // Caso não seja possível abrir o quadro, recupera a tela de origem.
     requestAnimationFrame(()=>{
       if(!dialog.open&&!appointmentDialog?.open)restoreAfterSpace(origin);
     });
   }
 }
 trigger.hidden=false;trigger.addEventListener("click",reopen);
 globalQuery.addEventListener("input",renderGlobalSearch);
 globalResults.addEventListener("click",event=>{
   const category=event.target.closest("button.hub-search-category");
   if(category&&SERVICES.some(info=>info.key===category.dataset.speciality)){
     showGroup(category.dataset.speciality);
     return;
   }
   const item=event.target.closest("button.hub-person");
   if(!item)return;
   const p=catalog.find(person=>person.id===item.dataset.id);
   if(p)openProfessional(p);
 });
 // Resultados permanecem imediatamente abaixo da pesquisa, sobre o Chat Médico,
 // sem abrir um segundo diálogo, sem o cabeçalho roxo e sem ler o iframe.
 let chatSelected=null,chatOpening=false;
 function renderChatSearch(){
   if(!chatSearch||!chatResults)return;
   const term=norm(chatSearch.value);
   chatSelected=null;
   chatResults.replaceChildren();
   chatResults.hidden=!term;
   if(!term)return;
   if(!loaded){
     chatResults.append(node("p","hub-empty","Carregando os profissionais disponíveis..."));
     return;
   }
   const matches=catalog.filter(p=>norm(p.name).includes(term))
     .sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
   if(!matches.length){
     chatResults.append(node("p","hub-empty",
       "Nenhum profissional com esse nome no catálogo disponível para seu acesso."));
     return;
   }
   for(const p of matches){
     const item=node("button","hub-person chat-search-person");item.type="button";
     item.dataset.chatId=p.id;
     const label=node("span","hub-person-copy");
     label.append(node("strong",null,p.name),node("small",null,p.title||p.category));
     item.append(profileAvatar(p,"small"),label,node("span","hub-person-arrow","Abrir no Chat Médico ›"));
     chatResults.append(item);
   }
 }
 function showChatProfile(p){
   if(!chatResults)return;
   chatSelected=p;chatResults.hidden=false;chatResults.replaceChildren();
   const head=node("div","chat-inline-profile");
   const details=node("div","hub-person-copy");
   details.append(node("strong",null,p.name),node("small",null,p.title||p.category));
   head.append(profileAvatar(p,"large"),details);
   const title=node("div","chat-inline-heading","Sobre o profissional");
   const summary=node("p","chat-inline-summary",publicProfileDescription(p));
   const meta=node("div","chat-inline-registration");
   meta.append(publicProfileInfo(p));
   const actions=node("div","chat-inline-actions");
   const go=node("button","chat-inline-open","Acessar atendimento");
   go.type="button";go.dataset.action="open";
   const backToResults=node("button","chat-inline-back","Voltar aos resultados");
   backToResults.type="button";backToResults.dataset.action="back";
   actions.append(go,backToResults);
   chatResults.append(head,meta,title,summary,actions);
 }
 if(chatSearch&&chatResults){
   chatSearch.addEventListener("input",renderChatSearch);
   chatSearch.addEventListener("focus",()=>{
     if(norm(chatSearch.value))renderChatSearch();
   });
   chatSearch.addEventListener("keydown",event=>{
     if(event.key==="Escape"){chatSearch.value="";renderChatSearch();chatSearch.blur();}
   });
   chatResults.addEventListener("click",event=>{
     const item=event.target.closest("button[data-chat-id]");
     if(!item)return;
     const p=catalog.find(entry=>entry.id===item.dataset.chatId);
     if(p)openProfessional(p);
   });
   document.addEventListener("pointerdown",event=>{
     if(chatShell&&!chatShell.contains(event.target))chatResults.hidden=true;
   });
 }
 grid.addEventListener("click",event=>{
   const card=event.target.closest("button.hub-category");
   if(card)showGroup(card.dataset.key);
 });
 list.addEventListener("click",event=>{
   const item=event.target.closest("button.hub-person");if(!item)return;
   const p=catalog.find(person=>person.id===item.dataset.id&&person.category===chosenService);
   if(p)openProfessional(p);
 });
 query.addEventListener("input",renderPeople);
 topBack.addEventListener("click",()=>{
   chosenService=null;
   showPane("categories");
   say("");
   globalQuery.focus({preventScroll:true});
 });
 el("hub-other").addEventListener("click",()=>{
   if(profileFromSearch){showPane("categories");globalQuery.focus({preventScroll:true});}
   else showPane("professionals");
 });
 dialog.addEventListener("cancel",e=>{
   e.preventDefault(); // não revelar a lista nativa antes de uma escolha explícita
   if(!profile.hidden)showPane("professionals");
   else if(!professionals.hidden)showPane("categories");
 });
 async function openNative(){
   // Não abre a interface médica na carga inicial. Somente após clique explícito.
   if(dialog.open)dialog.close();
   if(chatResults){chatResults.hidden=true;chatResults.replaceChildren();}
   if(chatSearch)chatSearch.value="";
   try{
     if(typeof widget.open!=="function")throw Error("Widget indisponível");
     await Promise.resolve(widget.open());
     document.body.classList.remove("pv-navigation-mode");
     document.documentElement.classList.add("pv-chat-mode");
     chatShell?.removeAttribute("hidden");
   }catch{
     document.body.classList.add("pv-navigation-mode");
     reopen();
     say("Não foi possível abrir o Chat Médico. Você pode continuar em Especialidades.");
   }
 }
 native.addEventListener("click",openNative);
 el("hub-shortcut-appointments").addEventListener("click",openAppointments);
 el("hub-shortcut-space").addEventListener("click",openMySpace);
 // Fechar Agendamentos devolve às Especialidades, nunca ao chat de forma involuntária.
 if(appointmentDialog){
   appointmentDialog.addEventListener("close",()=>{
     const destination=appointmentReturn;
     appointmentReturn="specialties";
     if(destination==="chat"||destination==="space")return;
     requestAnimationFrame(reopen);
   });
   el("appointments-specialties")?.addEventListener("click",()=>appointmentDialog.close());
   el("appointments-space")?.addEventListener("click",openMySpace);
   el("appointments-chat")?.addEventListener("click",()=>{
     appointmentReturn="chat";
     appointmentDialog.close();
     openNative();
   });
 }
 // No Chat Médico, os atalhos superiores seguem independentes.
 appointmentTrigger?.addEventListener("click",()=>{
   document.body.classList.add("pv-navigation-mode");
 },{capture:true});
 open.addEventListener("click",async()=>{
   if(!chosenPerson||busy)return;
   busy=true;open.disabled=true;say("Abrindo o atendimento de "+chosenPerson.name+"...");
   try{
     // Preserva o mesmo caminho individual da versão funcional 07/11.
     // O SDK só é aberto depois que a pessoa seleciona o profissional.
     const route="/professionals/"+encodeURIComponent(chosenPerson.id)+"/room";
     if(typeof widget.navigate==="function")await Promise.resolve(widget.navigate(route));
     else if(typeof widget.open_room==="function")await Promise.resolve(widget.open_room(chosenPerson.id));
     else throw new Error("Nenhum método individual disponível");
     dialog.close();
     document.body.classList.remove("pv-navigation-mode");
     document.documentElement.classList.add("pv-chat-mode");
     chatShell?.removeAttribute("hidden");
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
       description:typeof p.description==="string"?p.description.trim().slice(0,1800):"",
       avatar:typeof p.avatar==="string"?p.avatar:"",
       collegiate_number:typeof p.collegiate_number==="string"?p.collegiate_number.trim():"",
       status:p.status==="online"?"online":p.status==="offline"?"offline":null,
       languages:Array.isArray(p.languages)?p.languages.slice(0,8):[]
     }));
     loaded=true;renderCategories();
     if(chosenService)renderPeople();
     if(!catalog.length)note.textContent="Os profissionais ainda não foram carregados neste painel. Use Chat Médico para acessar o atendimento.";
     else if(data.profileData&&data.profileData.photos===0&&data.profileData.descriptions===0){
       note.textContent="O catálogo autorizado não retornou fotos nem descrições neste momento. Os perfis originais permanecem acessíveis no Chat Médico.";
     }
   }catch{
     loaded=true;renderCategories();
     note.textContent="Não foi possível consultar o catálogo. Você pode continuar pelo Chat Médico.";
     if(chosenService)renderPeople();
   }
 })();
 return true;
}
