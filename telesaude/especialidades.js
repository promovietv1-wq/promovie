/* PromoVie TeleSaúde: navegação visual independente do widget Médiquo.
   Não acessa credenciais, tokens, profissionais ou elementos internos do iframe.
   A lista de profissionais permanece exclusivamente na interface oficial. */
(function(){
"use strict";
const AREAS=[
 {id:"clinico",name:"Clínico geral",description:"Orientação médica online, 24 horas.",type:"Atendimento em até 10 minutos",tone:"violet"},
 {id:"psicologia",name:"Psicologia",description:"Escuta especializada e cuidado com a saúde mental.",type:"Com agendamento",tone:"rose"},
 {id:"nutricao",name:"Nutrição",description:"Orientação alimentar e qualidade de vida.",type:"Com agendamento",tone:"green"},
 {id:"fisico",name:"Treinamento físico",description:"Movimento, atividade física e bem-estar.",type:"Com agendamento",tone:"blue"},
 {id:"pediatria",name:"Pediatria",description:"Cuidado e orientação para a saúde das crianças.",type:"Consulte a disponibilidade",tone:"amber"},
 {id:"dermatologia",name:"Dermatologia",description:"Cuidados com a pele e orientação especializada.",type:"Com agendamento",tone:"cyan"},
 {id:"ginecologia",name:"Ginecologia",description:"Orientação e cuidado com a saúde feminina.",type:"Consulte a disponibilidade",tone:"lilac"},
 {id:"veterinaria",name:"Veterinária",description:"Orientação de saúde para animais de estimação.",type:"Modalidade a consultar",tone:"coral"}
];
const ICONS={
 clinico:'<path d="M6 3v5a6 6 0 0 0 12 0V3M4 3h4M16 3h4M12 14v2a4 4 0 0 0 8 0v-2"/><circle cx="20" cy="12" r="2"/>',
 psicologia:'<path d="M12 18V5a3 3 0 0 0-5.4-1.8A4 4 0 0 0 3 9a4 4 0 0 0 1 7 4 4 0 0 0 7 3M12 18V5a3 3 0 0 1 5.4-1.8A4 4 0 0 1 21 9a4 4 0 0 1-1 7 4 4 0 0 1-7 3"/><path d="M7 9c2 0 3 1 3 3M17 9c-2 0-3 1-3 3"/>',
 nutricao:'<path d="M12 7c-4-4-10 0-9 6 1 6 5 9 9 6 4 3 8 0 9-6 1-6-5-10-9-6Z"/><path d="M12 8c0-4 2-6 5-6M12 7c-2-3-4-3-6-3"/>',
 fisico:'<path d="M2 9v6M5 7v10M8 9v6M8 12h8M16 9v6M19 7v10M22 9v6"/>',
 pediatria:'<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M8.5 14c2 3 5 3 7 0M12 3c0 3-2 4-4 4"/>',
 dermatologia:'<path d="M12 22c5 0 8-3 8-8 0-4-8-12-8-12S4 10 4 14c0 5 3 8 8 8Z"/><path d="M8 15c.5 2 2 3 4 3"/>',
 ginecologia:'<path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 8-1 4 4 0 0 1 8 1Z"/><path d="M8 11h2l1-2 2 4 1-2h2"/>',
 veterinaria:'<circle cx="7" cy="6" r="1.3"/><circle cx="12" cy="4.5" r="1.3"/><circle cx="17" cy="6" r="1.3"/><circle cx="20" cy="10" r="1.3"/><path d="M12 12c-2.5 0-3.4 3.5-5.7 4.5-1.5.8-1 4.1.9 4.1 2.2 0 3-1 4.8-1s2.6 1 4.8 1c1.9 0 2.4-3.3.9-4.1C15.4 15.5 14.5 12 12 12Z"/>'
};
function icon(id){
 return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+ICONS[id]+'</svg>';
}
let initialized=false;
function init(){
 if(initialized)return;
 const root=document.getElementById("pv-specialties");
 const grid=document.getElementById("pv-specialties-grid");
 const intro=document.getElementById("pv-specialties-intro");
 const detail=document.getElementById("pv-specialties-detail");
 const toggle=document.getElementById("pv-specialties-toggle");
 const title=document.getElementById("pv-specialties-title");
 const detailName=document.getElementById("pv-detail-name");
 const detailText=document.getElementById("pv-detail-text");
 const detailType=document.getElementById("pv-detail-type");
 const detailIcon=document.getElementById("pv-detail-icon");
 const detailBack=document.getElementById("pv-detail-back");
 const toWidget=document.getElementById("pv-to-widget");
 const original=document.getElementById("pv-original-list");
 if(!root||!grid||!intro||!detail||!toggle||!title||!detailName||
    !detailText||!detailType||!detailIcon||!detailBack||!toWidget||!original)return;
 initialized=true;
 for(const area of AREAS){
   const card=document.createElement("button");
   card.type="button";card.className="pv-specialty-card pv-tone-"+area.tone;
   card.setAttribute("aria-label",area.name+". "+area.type+". Ver detalhes");
   card.innerHTML='<span class="pv-specialty-icon">'+icon(area.id)+'</span>'+
    '<span class="pv-specialty-name"></span><span class="pv-specialty-desc"></span>'+
    '<span class="pv-specialty-footer"><span class="pv-specialty-type"></span>'+
    '<span class="pv-specialty-chevron" aria-hidden="true">›</span></span>';
   card.querySelector(".pv-specialty-name").textContent=area.name;
   card.querySelector(".pv-specialty-desc").textContent=area.description;
   card.querySelector(".pv-specialty-type").textContent=area.type;
   card.addEventListener("click",()=>showDetail(area));
   grid.appendChild(card);
 }
 function showHome(shouldFocus){
   root.hidden=false;intro.hidden=false;grid.hidden=false;detail.hidden=true;
   document.body.classList.add("pv-specialties-active");
   root.scrollTop=0;toggle.hidden=false;
   toggle.setAttribute("aria-expanded","true");
   title.textContent="Como podemos cuidar de você?";
   if(shouldFocus)title.focus({preventScroll:true});
 }
 function showDetail(area){
   intro.hidden=true;grid.hidden=true;detail.hidden=false;
   detailName.textContent=area.name;
   detailText.textContent=area.description;
   detailType.textContent=area.type;
   detailIcon.innerHTML=icon(area.id);
   detailIcon.className="pv-detail-icon pv-tone-"+area.tone;
   toWidget.textContent="Ver profissionais na Médiquo";
   root.scrollTop=0;
   detailName.focus({preventScroll:true});
 }
 function showWidget(){
   root.hidden=true;
   document.body.classList.remove("pv-specialties-active");
   toggle.hidden=false;toggle.setAttribute("aria-expanded","false");
   toggle.focus({preventScroll:true});
 }
 detailBack.addEventListener("click",()=>showHome(true));
 toWidget.addEventListener("click",showWidget);
 original.addEventListener("click",showWidget);
 toggle.addEventListener("click",()=>{
   if(root.hidden)showHome(true);
   else showWidget();
 });
 root.addEventListener("keydown",function(e){
   if(e.key==="Escape"&&!root.hidden){
     e.preventDefault();showWidget();
   }
 });
 showHome(false);
}
window.PromoVieSpecialties={init:init};
document.dispatchEvent(new Event("promovie:specialties-loaded"));
})();