
/* Agendamentos PromoVie: links externos isolados da telemedicina Mediquo. */
(function(){
  "use strict";
  const trigger=document.getElementById("appointments-trigger");
  const dialog=document.getElementById("appointments-dialog");
  if(!trigger||!dialog)return;
  trigger.addEventListener("click",function(){
    if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
  });
  dialog.querySelector("[data-agenda-close]")?.addEventListener("click",function(){dialog.close();});
  dialog.addEventListener("click",function(event){if(event.target===dialog)dialog.close();});
})();
