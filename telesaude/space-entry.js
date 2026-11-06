/* Entrada opcional do Meu Espaço de Saúde. Independente da Médiquo e do login. */
(function(){
  "use strict";
  const link=document.querySelector(".space-entry");
  if(!link)return;
  fetch("https://backend.promovie.tv.br/api/promovie/space/v1/health",{
    method:"GET",mode:"cors",credentials:"omit",cache:"no-store",referrerPolicy:"no-referrer"
  }).then(function(response){
    return response.ok?response.json():null;
  }).then(function(data){
    if(data&&data.disponivel===true)link.hidden=false;
  }).catch(function(){
    // Falha ou recurso desligado: não exibir entrada sem backend ativo.
  });
})();
