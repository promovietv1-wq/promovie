/* Navegacao visual de especialidades, independente do widget MediQuo.
   Nao consulta listas restritas, altera sessoes nem presume disponibilidade. */
(function(){
  "use strict";
  const trigger=document.getElementById("specialties-trigger");
  const dialog=document.getElementById("specialties-dialog");
  const search=document.getElementById("specialties-query");
  const result=document.getElementById("specialties-result");
  const resultTitle=document.getElementById("specialties-result-title");
  const seeList=document.getElementById("specialties-see-list");
  const empty=document.getElementById("specialties-empty");
  const live=document.getElementById("specialties-live");
  const status=document.getElementById("status");
  if(!trigger||!dialog||!search||!result||!resultTitle||!seeList||!empty||!live||!status)return;
  const items=Array.from(dialog.querySelectorAll(".specialty-item"));
  const normalize=function(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .toLocaleLowerCase("pt-BR").replace(/\s+/g," ").trim();
  };
  const ready=function(){trigger.disabled=!status.hidden;};
  ready();
  const observer=new MutationObserver(ready);
  observer.observe(status,{attributes:true,attributeFilter:["hidden"]});
  let chosen=null;
  function clearSelection(){
    chosen=null;result.hidden=true;
    for(const item of items)item.setAttribute("aria-pressed","false");
  }
  function filter(){
    clearSelection();
    const term=normalize(search.value);
    let count=0;
    for(const item of items){
      const show=normalize(item.textContent).includes(term);
      item.hidden=!show;
      if(show)count++;
    }
    empty.hidden=count!==0;
    live.hidden=true;
  }
  trigger.addEventListener("click",function(){
    if(trigger.disabled)return;
    search.value="";filter();
    if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
    search.focus();
  });
  dialog.querySelector("[data-specialties-close]")?.addEventListener("click",function(){dialog.close();});
  dialog.addEventListener("click",function(event){if(event.target===dialog)dialog.close();});
  search.addEventListener("input",filter);
  for(const item of items){
    item.addEventListener("click",function(){
      chosen=item.dataset.specialty;
      for(const candidate of items)candidate.setAttribute("aria-pressed",String(candidate===item));
      resultTitle.textContent=chosen;
      result.hidden=false;
      live.hidden=true;
    });
  }
  seeList.addEventListener("click",function(){
    if(!chosen)return;
    const sdk=window.MediquoWidget;
    // open_list e documentado pela MediQuo, mas nem toda versao brasileira o fornece.
    if(sdk&&typeof sdk.open_list==="function"){
      try{
        const answer=sdk.open_list();
        if(answer&&typeof answer.catch==="function")answer.catch(function(){});
        dialog.close();
        return;
      }catch{}
    }
    // Caso o SDK instalado nao exponha open_list, nao alterar a lista interna.
    live.textContent="Abra a lista pela navegação do atendimento. Esta versão não permite acessá-la diretamente.";
    live.hidden=false;
  });
})();