/* Acesso ao espaço pessoal somente após a interface de atendimento abrir.
   Este script não toca na Médiquo, seus tokens, sessões ou iframe. */
(function(){
  "use strict";
  const footer=document.querySelector(".space-footer");
  const status=document.getElementById("status");
  if(!footer||!status)return;

  // Permite solicitar foco da consulta aberta em outra aba, sem navegar,
  // compartilhar credenciais ou reinicializar a interface da Médiquo.
  if(typeof BroadcastChannel==="function"){
    const channel=new BroadcastChannel("promovie:telesaude:alternancia:v1");
    channel.addEventListener("message",function(event){
      const data=event.data;
      if(!data||data.type!=="focus-attendance"||
         typeof data.id!=="string"||data.id.length>64||!status.hidden)return;
      channel.postMessage({type:"attendance-ready",id:data.id});
      try{window.focus();}catch{}
    });
  }

  function enableWhenReady(){
    if(!status.hidden)return false;
    document.documentElement.classList.add("space-link-ready");
    footer.hidden=false;
    return true;
  }

  fetch("https://backend.promovie.tv.br/api/promovie/space/v1/health",{
    method:"GET",mode:"cors",credentials:"omit",cache:"no-store",
    referrerPolicy:"no-referrer"
  }).then(function(response){
    return response.ok?response.json():null;
  }).then(function(data){
    if(!data||data.disponivel!==true)return;
    if(enableWhenReady())return;
    const observer=new MutationObserver(function(){
      if(enableWhenReady())observer.disconnect();
    });
    observer.observe(status,{attributes:true,attributeFilter:["hidden"]});
  }).catch(function(){
    // Sem backend disponível, manter o atendimento sem barra adicional.
  });
})();
