/* Instalação da Telessaúde PromoVie. Sem cache, sem login, sem SDK e sem dados de pacientes. */
self.addEventListener('install',function(){self.skipWaiting();});
self.addEventListener('activate',function(event){event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',function(event){
  const request=event.request;
  // Somente a página pública de entrada, sempre pela rede.
  // Qualquer requisição da Médiquo, atendimento, sessão ou API permanece intocada.
  if(request.method!=='GET'||request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||
     (url.pathname!=='/telesaude/'&&url.pathname!=='/telesaude/index.html'))return;
  event.respondWith(fetch(request));
});
