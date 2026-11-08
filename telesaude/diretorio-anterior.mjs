/* Diretório real da PromoVie. O Widget MediQuo permanece dono da sessão e das salas.
   Sem catálogo autenticado ou sem open_room, nenhuma interface adicional é exibida. */
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
const BASE="https://backend.promovie.tv.br/api/promovie/directory/v1/catalog";
const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
function groupFor(person){
  const label=norm(person.title);
  for(const [group,test] of ORDER)if(test.test(label))return group;
  return "Outras especialidades";
}
function validPerson(x){
  return x&&typeof x==="object"&&/^[A-Za-z0-9_-]{1,128}$/.test(x.id||"")&&
    typeof x.name==="string"&&x.name.trim().length>1&&x.name.length<=90&&
    typeof x.title==="string"&&x.title.length<=90;
}
export async function initDirectory(widget,grant,sdkToken){
  if(!widget||typeof widget.open_room!=="function"||
    typeof grant!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(grant)||
    typeof sdkToken!=="string"||sdkToken.length<24||sdkToken.length>4096)return false;
  const trigger=document.getElementById("directory-open");
  const dialog=document.getElementById("directory-dialog");
  const query=document.getElementById("directory-query");
  const container=document.getElementById("directory-results");
  const feedback=document.getElementById("directory-feedback");
  const close=document.getElementById("directory-close");
  if(!trigger||!dialog||!query||!container||!feedback||!close)return false;
  let catalog;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(BASE,{method:"POST",
      headers:{Authorization:"Bearer "+grant,"Content-Type":"application/json"},
      body:JSON.stringify({sdk_access_token:sdkToken}),
      cache:"no-store",credentials:"omit",referrerPolicy:"no-referrer",signal:controller.signal});
    if(!response.ok)return false;
    const data=await response.json();
    if(!data?.available||!Array.isArray(data.items))return false;
    const unique=new Set();
    catalog=data.items.filter(person=>{
      if(!validPerson(person)||unique.has(person.id))return false;
      unique.add(person.id);return true;
    }).slice(0,120).map(person=>({
      id:person.id,name:person.name.trim(),title:person.title.trim(),category:groupFor(person)
    }));
    if(!catalog.length)return false;
  }catch{return false;}
  finally{clearTimeout(timeout);}
  const collator=new Intl.Collator("pt-BR",{sensitivity:"base"});
  catalog.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));
  const sections=[...ORDER.map(x=>x[0]),"Outras especialidades"];
  let busy=false;
  function draw(){
    const search=norm(query.value);
    container.replaceChildren();
    const shown=catalog.filter(person=>norm([person.name,person.title,person.category].join(" ")).includes(search));
    for(const category of sections){
      const group=shown.filter(p=>p.category===category).sort((a,b)=>collator.compare(a.name,b.name));
      if(!group.length)continue;
      const section=document.createElement("section");
      section.className="directory-section";
      const title=document.createElement("h3");
      title.textContent=category;
      section.appendChild(title);
      const list=document.createElement("div");
      list.className="directory-list";
      for(const person of group){
        const item=document.createElement("button");
        item.type="button";item.className="directory-person";
        item.dataset.id=person.id;
        const content=document.createElement("span");
        const name=document.createElement("strong");name.textContent=person.name;
        content.appendChild(name);
        if(person.title&&norm(person.title)!==norm(category)){
          const subtitle=document.createElement("small");subtitle.textContent=person.title;
          content.appendChild(subtitle);
        }
        const icon=document.createElement("span");icon.className="directory-chevron";
        icon.setAttribute("aria-hidden","true");
        item.append(content,icon);
        list.appendChild(item);
      }
      section.appendChild(list);
      container.appendChild(section);
    }
    feedback.textContent=shown.length?"": "Nenhum profissional encontrado.";
  }
  draw();
  query.addEventListener("input",draw);
  trigger.addEventListener("click",()=>{
    query.value="";draw();feedback.textContent="";
    if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
    query.focus();
  });
  close.addEventListener("click",()=>{if(!busy&&dialog.open)dialog.close();});
  dialog.addEventListener("click",event=>{if(event.target===dialog&&!busy)dialog.close();});
  container.addEventListener("click",async event=>{
    const button=event.target.closest("button.directory-person");
    if(!button||busy)return;
    const person=catalog.find(x=>x.id===button.dataset.id);
    if(!person)return;
    busy=true;button.disabled=true;feedback.textContent="Abrindo conversa...";
    try{
      const result=widget.open_room(person.id);
      await Promise.resolve(result);
      if(dialog.open)dialog.close();
    }catch{
      feedback.textContent="Não foi possível abrir esta conversa. Use a lista original do atendimento.";
    }finally{
      busy=false;button.disabled=false;
    }
  });
  trigger.hidden=false;
  return true;
}
