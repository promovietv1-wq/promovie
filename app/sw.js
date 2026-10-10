/* PromoVie PWA: offline apenas da interface pública, nunca de dados de consultas ou páginas da Levita. */
const CACHE="promovie-app-shell-v3";
const SHELL=["/app/","/app/inicio/","/app/telemedicina/","/app/manifest.webmanifest","/app/icons/icon-192.png","/app/icons/icon-512.png","/app/icons/icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("promovie-app-shell-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith("/app/"))return;
 // A configuração do portal é sempre consultada on-line, sem cache.
 if(url.pathname==="/app/config.js")return;
 if(request.mode==="navigate"){
  event.respondWith(fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>caches.match(request).then(match=>match||caches.match("/app/inicio/"))));
  return;
 }
 event.respondWith(caches.match(request).then(match=>match||fetch(request).then(response=>{
  if(response.ok&&["/app/manifest.webmanifest","/app/icons/icon-192.png","/app/icons/icon-512.png","/app/icons/icon.svg"].includes(url.pathname)){
   const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));
  }
  return response;
 })));
});
